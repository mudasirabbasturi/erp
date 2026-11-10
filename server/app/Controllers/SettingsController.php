<?php
namespace App\Controllers;

use Core\Controller;
use Core\Request;
use Core\Response;
use Core\Database;

class SettingsController extends Controller
{
    /**
     * Get all system settings grouped by category
     */
    public function getSettings(Request $request): Response
    {
        $rows = Database::fetchAll("SELECT `key`, `value`, `group`, `type` FROM `system_settings` ORDER BY `id` ASC");
        
        $settings = [];
        foreach ($rows as $r) {
            $val = $r['value'];
            if ($r['type'] === 'json') {
                $val = json_decode($val, true) ?: [];
                // Mask API keys in json for security
                if (isset($val['api_key']) && !empty($val['api_key'])) {
                    $keyLen = strlen($val['api_key']);
                    $val['api_key_masked'] = $keyLen > 8 ? substr($val['api_key'], 0, 4) . '••••••••' . substr($val['api_key'], -4) : '••••••••';
                    $val['has_api_key'] = true;
                } else {
                    $val['has_api_key'] = false;
                }
            } elseif ($r['type'] === 'boolean') {
                $val = (bool)$val;
            }
            $settings[$r['key']] = $val;
        }

        return Response::success($settings);
    }

    /**
     * Update system settings and AI guardrails
     */
    public function updateSettings(Request $request): Response
    {
        $payload = $request->all();
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("
            INSERT INTO `system_settings` (`key`, `value`, `group`, `type`, `created_at`, `updated_at`)
            VALUES (:key, :value, :group, :type, NOW(), NOW())
            ON DUPLICATE KEY UPDATE `value` = :update_val, `updated_at` = NOW()
        ");

        foreach ($payload as $key => $val) {
            // Strictly enforce AI Delete guardrail is NEVER enabled
            if ($key === 'ai_guardrail_delete') {
                $val = '0';
            }

            $type = 'string';
            $group = 'general';

            if (str_starts_with($key, 'ai_')) {
                $group = 'ai';
                if (str_starts_with($key, 'ai_provider_')) {
                    $type = 'json';
                    // If api_key in payload is masked or unchanged, keep existing key
                    if (is_array($val)) {
                        $existing = Database::fetch("SELECT `value` FROM `system_settings` WHERE `key` = :k", ['k' => $key]);
                        if ($existing && !empty($existing['value'])) {
                            $exData = json_decode($existing['value'], true) ?: [];
                            if (empty($val['api_key']) && !empty($exData['api_key'])) {
                                $val['api_key'] = $exData['api_key'];
                            }
                        }
                        unset($val['api_key_masked']);
                        unset($val['has_api_key']);
                        $val = json_encode($val);
                    }
                } elseif (str_starts_with($key, 'ai_guardrail_')) {
                    $type = 'boolean';
                    $val = $val ? '1' : '0';
                }
            } elseif (str_starts_with($key, 'pusher_')) {
                $group = 'sockets';
            }

            if (is_array($val) && $type !== 'json') {
                $val = json_encode($val);
                $type = 'json';
            } elseif (is_bool($val)) {
                $val = $val ? '1' : '0';
                $type = 'boolean';
            }

            $stmt->execute([
                'key' => $key,
                'value' => (string)$val,
                'group' => $group,
                'type' => $type,
                'update_val' => (string)$val
            ]);
        }

        return Response::success(null, 'Settings updated successfully');
    }

    /**
     * Test connection to a specific AI provider
     */
    public function testAIConnection(Request $request): Response
    {
        $provider = $request->input('provider', 'gemini');
        $apiKey = $request->input('api_key');
        $model = $request->input('model');

        // If no api key passed in request, load from database
        if (empty($apiKey)) {
            $setting = Database::fetch("SELECT `value` FROM `system_settings` WHERE `key` = :k", ['k' => "ai_provider_{$provider}"]);
            if ($setting) {
                $pData = json_decode($setting['value'], true);
                $apiKey = $pData['api_key'] ?? '';
                if (empty($model)) {
                    $model = $pData['model'] ?? '';
                }
            }
        }

        if (empty($apiKey)) {
            return Response::error("API Key for {$provider} is not configured.", 400);
        }

        $result = $this->callAIProvider($provider, $apiKey, $model, "Ping test. Reply with 'Connected successfully to " . ucfirst($provider) . "!' in 5 words.");
        if ($result['success']) {
            return Response::success(['reply' => $result['reply']], "Connected successfully to " . ucfirst($provider));
        }

        return Response::error($result['error'] ?? "Failed to connect to {$provider}", 400);
    }

    /**
     * Chat with AI Agent with database awareness and strict guardrails
     */
    public function chatAI(Request $request): Response
    {
        $message = trim($request->input('message', ''));
        $conversationId = (int)$request->input('conversation_id', 0);
        $projectId = (int)$request->input('project_id', 0);
        $currentUser = $this->user($request);
        $userId = $currentUser ? (int)$currentUser['id'] : 1;

        if (empty($message)) {
            return Response::error('Message cannot be empty', 400);
        }

        // 1. Guardrail Check: Block DELETE / DROP requests
        $lowerMsg = strtolower($message);
        if (preg_match('/\b(delete|drop|truncate|destroy|purge|remove all)\b/i', $message) &&
            (str_contains($lowerMsg, 'project') || str_contains($lowerMsg, 'user') || str_contains($lowerMsg, 'client') || str_contains($lowerMsg, 'database') || str_contains($lowerMsg, 'table'))) {
            return Response::success([
                'reply' => "⚠️ **Operation Blocked by Security Guardrails**:\nAI models are strictly forbidden from executing data deletion or removal commands (`ai_guardrail_delete = false`). All existing project, user, and client records are protected.",
                'action_taken' => 'blocked',
                'conversation_id' => $conversationId
            ]);
        }

        // 2. Fetch Active AI Provider Configuration
        $activeSetting = Database::fetch("SELECT `value` FROM `system_settings` WHERE `key` = 'ai_active_provider'");
        $provider = $activeSetting ? $activeSetting['value'] : 'gemini';

        $providerSetting = Database::fetch("SELECT `value` FROM `system_settings` WHERE `key` = :k", ['k' => "ai_provider_{$provider}"]);
        $pConfig = $providerSetting ? json_decode($providerSetting['value'], true) : [];
        $apiKey = $pConfig['api_key'] ?? '';
        $model = $pConfig['model'] ?? 'gemini-1.5-pro';

        // 3. Ensure Conversation Exists
        $pdo = Database::getConnection();
        if ($conversationId <= 0) {
            $convTitle = substr($message, 0, 45) . (strlen($message) > 45 ? '...' : '');
            $stmt = $pdo->prepare("INSERT INTO `ai_conversations` (`user_id`, `title`, `provider`, `model`, `created_at`, `updated_at`) VALUES (:uid, :title, :p, :m, NOW(), NOW())");
            $stmt->execute(['uid' => $userId, 'title' => $convTitle, 'p' => $provider, 'm' => $model]);
            $conversationId = (int)$pdo->lastInsertId();
        }

        // Save User Message
        $stmt = $pdo->prepare("INSERT INTO `ai_messages` (`conversation_id`, `role`, `content`, `model`, `created_at`) VALUES (:cid, 'user', :content, :m, NOW())");
        $stmt->execute(['cid' => $conversationId, 'content' => $message, 'm' => $model]);

        // 4. Built-in Agent Tools / ERP Action Resolvers
        $agentAction = $this->resolveAgentAction($message, $conversationId, $projectId);
        if ($agentAction !== null) {
            $assistantReply = $agentAction['reply'];
        } else {
            // Context-Aware Prompt Construction with Dynamic Live Database Retrieval
            $systemContext = $this->buildSystemContext($message, $projectId);

            // Include recent conversation messages so LLM has context of prior instructions
            $historyPrompt = "";
            if ($conversationId > 0) {
                $history = Database::fetchAll("
                    SELECT `role`, `content`
                    FROM `ai_messages`
                    WHERE `conversation_id` = :cid
                    ORDER BY `id` DESC
                    LIMIT 6
                ", ['cid' => $conversationId]);
                if (!empty($history)) {
                    $history = array_reverse($history);
                    $historyPrompt = "\n\n=== RECENT CONVERSATION HISTORY ===\n";
                    foreach ($history as $h) {
                        $r = ucfirst($h['role']);
                        $historyPrompt .= "{$r}: " . trim($h['content']) . "\n";
                    }
                }
            }

            $fullPrompt = $systemContext . $historyPrompt . "\n\nUser Question: " . $message;

            $aiResult = $this->callAIProvider($provider, $apiKey, $model, $fullPrompt);
            if ($aiResult['success']) {
                $assistantReply = $aiResult['reply'];

                // Execute embedded CREATE_PROJECT tag from LLM if present
                if (preg_match('/\[\[CREATE_PROJECT:\s*(\{.*?\})\]\]/s', $assistantReply, $cpm)) {
                    $cData = json_decode($cpm[1], true);
                    if ($cData && !empty($cData['title'])) {
                        $pTitle = trim($cData['title']);
                        $pStatus = !empty($cData['status']) ? trim($cData['status']) : 'Pending';
                        $pDue = !empty($cData['due_date']) ? trim($cData['due_date']) : date('Y-m-d', strtotime('+30 days'));

                        $newId = Database::insert('projects', [
                            'project_title' => $pTitle,
                            'project_progress_status' => $pStatus,
                            'project_preview_status' => 'active',
                            'is_project_late' => 0,
                            'project_due_date' => $pDue,
                            'project_admin_notes' => 'Created via AI Assistant.',
                            'created_at' => date('Y-m-d H:i:s'),
                            'updated_at' => date('Y-m-d H:i:s')
                        ]);

                        $badge = "\n\n---\n### ✅ Project Created in Database!\n- **[#{$newId} - {$pTitle}](/projects/view/{$newId})** (Status: `{$pStatus}`, Due: `{$pDue}`)\n- [Open Project View](/projects/view/{$newId}) · [Edit Project Form](/projects/edit/{$newId})";
                        $assistantReply = str_replace($cpm[0], $badge, $assistantReply);
                    }
                }

                // Execute embedded UPDATE_PROJECT tag from LLM if present
                if (preg_match('/\[\[UPDATE_PROJECT:\s*(\{.*?\})\]\]/s', $assistantReply, $upm)) {
                    $uData = json_decode($upm[1], true);
                    if ($uData && !empty($uData['id']) && !empty($uData['fields'])) {
                        $targetId = (int)$uData['id'];
                        $fields = (array)$uData['fields'];
                        $allowed = ['project_title', 'project_progress_status', 'project_due_date', 'project_admin_notes', 'project_estimator_notes'];
                        $validUpdates = [];
                        foreach ($fields as $k => $v) {
                            if (in_array($k, $allowed)) {
                                $validUpdates[$k] = $v;
                            }
                        }
                        if (!empty($validUpdates)) {
                            $validUpdates['updated_at'] = date('Y-m-d H:i:s');
                            Database::update('projects', $validUpdates, 'id = :id', ['id' => $targetId]);
                            $badge = "\n\n---\n### ✅ Project #{$targetId} Updated in Database!\n- [View Updated Project](/projects/view/{$targetId}) · [Edit Full Form](/projects/edit/{$targetId})";
                            $assistantReply = str_replace($upm[0], $badge, $assistantReply);
                        }
                    }
                }
            } else {
                // Graceful fallback assistant with real database context if API key not set or connection error
                $assistantReply = $this->generateLocalAssistantReply($message, $provider, $aiResult['error'] ?? null, $projectId);
            }
        }

        // Save Assistant Reply
        $stmt = $pdo->prepare("INSERT INTO `ai_messages` (`conversation_id`, `role`, `content`, `model`, `created_at`) VALUES (:cid, 'assistant', :content, :m, NOW())");
        $stmt->execute(['cid' => $conversationId, 'content' => $assistantReply, 'm' => $model]);

        return Response::success([
            'reply' => $assistantReply,
            'provider' => $provider,
            'model' => $model,
            'conversation_id' => $conversationId
        ]);
    }

    /**
     * Get user's AI conversations list
     */
    public function getConversations(Request $request): Response
    {
        $currentUser = $this->user($request);
        $userId = $currentUser ? (int)$currentUser['id'] : 1;

        $conversations = Database::fetchAll("
            SELECT c.*,
                   (SELECT COUNT(*) FROM ai_messages WHERE conversation_id = c.id) AS message_count,
                   (SELECT content FROM ai_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) AS last_message
            FROM ai_conversations c
            WHERE c.user_id = :uid
            ORDER BY c.updated_at DESC
            LIMIT 50
        ", ['uid' => $userId]);

        return Response::success($conversations);
    }

    /**
     * Get messages for a conversation
     */
    public function getConversationMessages(Request $request): Response
    {
        $id = (int)$request->query('id', 0);
        if ($id <= 0) {
            return Response::error('Conversation ID is required', 400);
        }

        $messages = Database::fetchAll("
            SELECT id, conversation_id, role, content, model, created_at
            FROM ai_messages
            WHERE conversation_id = :cid
            ORDER BY id ASC
        ", ['cid' => $id]);

        return Response::success($messages);
    }

    /**
     * Clear / Delete a conversation
     */
    public function clearConversation(Request $request): Response
    {
        $id = (int)$request->input('id', 0);
        if ($id <= 0) {
            return Response::error('Conversation ID is required', 400);
        }

        Database::query("DELETE FROM ai_messages WHERE conversation_id = :cid", ['cid' => $id]);
        Database::query("DELETE FROM ai_conversations WHERE id = :cid", ['cid' => $id]);

        return Response::success(null, 'Conversation deleted');
    }

    /**
     * Resolve ERP specific action queries directly
     */
    private function resolveAgentAction(string $message, int $conversationId = 0, int $projectId = 0): ?array
    {
        // 1. Direct Project Creation Handler
        $isCreateRequest = (
            preg_match('/(?:create|add|make|insert|generate|start|build|setup|set up)\s+(?:a\s+)?(?:new\s+)?project/i', $message) ||
            preg_match('/(?:just\s+(?:add|create)\s+(?:dummy\s+)?title|create\s+project|add\s+project|lets\s+create\s+(?:a\s+)?project)/i', $message) ||
            (str_contains(strtolower($message), 'create') && str_contains(strtolower($message), 'project')) ||
            (str_contains(strtolower($message), 'add') && str_contains(strtolower($message), 'project')) ||
            (preg_match('/(?:title|tile)\s*(?:is|should be|shoud be|=)/i', $message) && (str_contains(strtolower($message), 'project') || str_contains(strtolower($message), 'add') || str_contains(strtolower($message), 'create') || str_contains(strtolower($message), 'build') || str_contains(strtolower($message), 'first'))) ||
            preg_match('/(?:just\s+add|add\s+it|create\s+it|do\s+it|save\s+it|go\s+ahead)\s+(?:with|now|as)/i', $message)
        );

        if ($isCreateRequest) {
            $guardrailAdd = Database::fetchColumn("SELECT `value` FROM system_settings WHERE `key` = 'ai_guardrail_add'");
            $canCreate = ($guardrailAdd === false || $guardrailAdd === null || $guardrailAdd === '1' || $guardrailAdd === 1);

            if (!$canCreate) {
                return [
                    'reply' => "⚠️ **Action Blocked by Security Guardrails**:\nCreating new projects via AI is currently disabled in your portal settings (`ai_guardrail_add = false`). You can enable this in [Settings > AI Models](/settings/ai-models)."
                ];
            }

            // Extract or generate project title
            $title = null;

            // Pattern A: Explicit parentheses/brackets/quotes after title/tile/name/named/called/project
            if (preg_match('/(?:title|tile|name|named|called|project)\s*(?:is|as|should be|shoud be|to|:|=)?\s*[\(\[\{"\']\s*([^\)\]\}"\']{2,150})\s*[\)\]\}"\']/i', $message, $m)) {
                $title = trim($m[1]);
            }
            // Pattern B: Any explicit parentheses (...) in the message containing title text
            if (empty($title) && preg_match('/\(\s*([^)\n]{3,150}?)\s*\)/i', $message, $m)) {
                $cand = trim($m[1]);
                if (!in_array(strtolower($cand), ['safe mode', 'pending', 'completed', 'active', 'deliver'])) {
                    $title = $cand;
                }
            }
            // Pattern C: Any explicit quotes "..." or '...' in the message
            if (empty($title) && preg_match('/["\']([^"\'\n]{3,150})["\']/i', $message, $m)) {
                $cand = trim($m[1]);
                if (!in_array(strtolower($cand), ['safe mode', 'pending', 'completed', 'active', 'deliver'])) {
                    $title = $cand;
                }
            }
            // Pattern D: "create a project named/called/titled X"
            if (empty($title) && preg_match('/(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?project\s+(?:titled|named|called)\s+([a-zA-Z0-9\s\-_\.,#&]+?)(?:\s+(?:with|and|status|due|scope|notes|rest)|\s*$)/i', $message, $m)) {
                $cand = trim($m[1]);
                if (!empty($cand) && !in_array(strtolower($cand), ['is', 'must', 'fill', 'dummy', 'a', 'the', 'blank', 'default'])) {
                    $title = $cand;
                }
            }
            // Pattern E: title is / title should be without quotes
            if (empty($title) && preg_match('/(?:title|tile|name)\s*(?:is|should be|shoud be|:|=)\s+([a-zA-Z0-9\s\-_\.,#&]+?)(?:\s+(?:with|and|status|due|scope|notes|rest|lets)|\s*$)/i', $message, $m)) {
                $cand = trim($m[1]);
                if (!empty($cand) && !in_array(strtolower($cand), ['is', 'must', 'fill', 'dummy', 'a', 'the', 'blank', 'default', 'must fill'])) {
                    $title = $cand;
                }
            }

            // Pattern F: If user said "just add with above data", borrow from previous message if available
            if (empty($title) && $conversationId > 0) {
                $prev = Database::fetch("SELECT `content` FROM `ai_messages` WHERE `conversation_id` = :cid ORDER BY `id` DESC LIMIT 1", ['cid' => $conversationId]);
                if ($prev && !empty($prev['content'])) {
                    if (preg_match('/(?:title|tile|named)\s*[:=]?\s*[\*_\'"]*([a-zA-Z0-9\s\-_\.,#&]{3,100})[\*_\'"]*/i', $prev['content'], $pm)) {
                        $cand = trim($pm[1]);
                        if (!in_array(strtolower($cand), ['is', 'must', 'fill', 'dummy', 'default'])) {
                            $title = $cand;
                        }
                    }
                }
            }

            // ONLY generate dummy preset if user has NOT provided any title OR explicitly requested dummy/placeholder
            if (empty($title) || (empty($title) && (str_contains(strtolower($message), 'dummy') || str_contains(strtolower($message), 'placeholder') || str_contains(strtolower($message), 'just title is must fill')))) {
                $presets = [
                    'Metropolitan Commercial Plaza Takeoff',
                    'Sunset Ridge Residential Addition',
                    'Summit Creek Medical Facility Expansion',
                    'Valley View Retail Center Renovation',
                    'Harbor Point Multi-Family Building',
                    'Oakwood Elementary Gymnasium Addition'
                ];
                $preset = $presets[array_rand($presets)];
                $title = "Sample Project - " . $preset;
                if (str_contains(strtolower($message), 'dummy title') || str_contains(strtolower($message), 'dummy content')) {
                    $title = "Sample Project - " . date('M j, Y H:i');
                }
            }

            // Status default: Pending
            $status = 'Pending';
            if (preg_match('/status\s+(?:to\s+|as\s+)?["\']?([a-zA-Z\s]+)["\']?/i', $message, $sm)) {
                $candStatus = trim($sm[1]);
                $validStatuses = [
                    'planned' => 'Planned',
                    'pending' => 'Pending',
                    'takeoff on progress' => 'Takeoff On Progress',
                    'pricing on progress' => 'Pricing On Progress',
                    'completed' => 'Completed',
                    'hold' => 'Hold',
                    'revision' => 'Revision',
                    'cancelled' => 'Cancelled',
                    'deliver' => 'Deliver'
                ];
                foreach ($validStatuses as $k => $v) {
                    if (str_contains(strtolower($candStatus), $k)) {
                        $status = $v;
                        break;
                    }
                }
            }

            // Due Date (optional, default 30 days from now)
            $dueDate = date('Y-m-d', strtotime('+30 days'));
            if (preg_match('/due\s*(?:date)?\s*(?:is|to|=|:)?\s*["\']?(\d{4}-\d{2}-\d{2})["\']?/i', $message, $dm)) {
                $dueDate = $dm[1];
            }

            $newProjectId = Database::insert('projects', [
                'project_title' => $title,
                'project_progress_status' => $status,
                'project_preview_status' => 'active',
                'is_project_late' => 0,
                'project_due_date' => $dueDate,
                'project_admin_notes' => 'Created automatically by AI Assistant as requested.',
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);

            $reply = "### ✅ Project Created Successfully in Database!\n\n"
                . "I have created the project record with the required title and default settings:\n\n"
                . "- **Project ID:** `#" . $newProjectId . "`\n"
                . "- **Title:** **[" . $title . "](/projects/view/" . $newProjectId . ")**\n"
                . "- **Status:** `" . $status . "`\n"
                . "- **Due Date:** `" . $dueDate . "`\n\n"
                . "👉 **Quick Actions:**\n"
                . "- [Open Project View Page](/projects/view/" . $newProjectId . ")\n"
                . "- [Edit Full Form / Assign Scope & Clients](/projects/edit/" . $newProjectId . ")\n\n"
                . "*All other project parameters are initialized with defaults as requested. You can assign clients, team members, or update notes anytime!*";

            return [
                'reply' => $reply,
                'action_taken' => 'create_project',
                'project_id' => $newProjectId
            ];
        }

        // 2. Direct Project Update Handler
        $targetId = 0;
        if (preg_match('/(?:update|change|set|mark|modify)\s+(?:project\s+)?#?(\d+)/i', $message, $um)) {
            $targetId = (int)$um[1];
        } elseif ($projectId > 0 && preg_match('/(?:update|change|set|mark|modify)\s+(?:project\s+)?(?:status|title|due\s*date|progress)/i', $message)) {
            $targetId = $projectId;
        }

        if ($targetId > 0) {
            $guardrailEdit = Database::fetchColumn("SELECT `value` FROM system_settings WHERE `key` = 'ai_guardrail_edit'");
            $canUpdate = ($guardrailEdit === false || $guardrailEdit === null || $guardrailEdit === '1' || $guardrailEdit === 1);

            if (!$canUpdate) {
                return [
                    'reply' => "⚠️ **Action Blocked by Security Guardrails**:\nUpdating projects via AI is currently disabled in your portal settings (`ai_guardrail_edit = false`). You can enable this in [Settings > AI Models](/settings/ai-models)."
                ];
            }

            $existing = Database::fetch("SELECT id, project_title, project_progress_status FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $targetId]);
            if (!$existing) {
                return [
                    'reply' => "⚠️ **Project Not Found**: Could not locate an active project with ID `#{$targetId}`."
                ];
            }

            $updates = [];
            $updateDesc = [];

            // Check for status update
            if (preg_match('/status\s+(?:to\s+|as\s+)?["\']?([a-zA-Z\s]+)["\']?/i', $message, $sm)) {
                $rawStatus = trim($sm[1]);
                $validStatuses = [
                    'planned' => 'Planned',
                    'pending' => 'Pending',
                    'takeoff on progress' => 'Takeoff On Progress',
                    'pricing on progress' => 'Pricing On Progress',
                    'completed' => 'Completed',
                    'hold' => 'Hold',
                    'revision' => 'Revision',
                    'cancelled' => 'Cancelled',
                    'deliver' => 'Deliver'
                ];
                foreach ($validStatuses as $k => $v) {
                    if (str_contains(strtolower($rawStatus), $k)) {
                        $updates['project_progress_status'] = $v;
                        $updateDesc[] = "Status changed to `{$v}`";
                        break;
                    }
                }
            }

            // Check for title update
            if (preg_match('/title\s+(?:to\s+)?["\']([^"\']+)["\']/i', $message, $tm)) {
                $newTitle = trim($tm[1]);
                $updates['project_title'] = $newTitle;
                $updateDesc[] = "Title updated to **\"{$newTitle}\"**";
            }

            // Check for due date update
            if (preg_match('/due\s*(?:date)?\s*(?:to\s+|as\s+)?["\']?(\d{4}-\d{2}-\d{2})["\']?/i', $message, $dm)) {
                $updates['project_due_date'] = $dm[1];
                $updateDesc[] = "Due date updated to `{$dm[1]}`";
            }

            if (!empty($updates)) {
                $updates['updated_at'] = date('Y-m-d H:i:s');
                Database::update('projects', $updates, 'id = :id', ['id' => $targetId]);

                $reply = "### ✅ Project #{$targetId} Updated Successfully in Database!\n\n"
                    . "The following changes have been saved to **[#{$targetId} - {$existing['project_title']}](/projects/view/{$targetId})**:\n"
                    . "- " . implode("\n- ", $updateDesc) . "\n\n"
                    . "👉 [Open Project View](/projects/view/{$targetId}) · [Edit Full Form](/projects/edit/{$targetId})";

                return [
                    'reply' => $reply,
                    'action_taken' => 'update_project',
                    'project_id' => $targetId
                ];
            }
        }

        // 3. Search / Find project by name
        if (preg_match('/(?:find|search|lookup|where is|link for)\s+(?:project\s+)?["\']?([^"\'\?]+)["\']?/i', $message, $m)) {
            $term = trim($m[1]);
            // Exclude generic greetings or questions
            if (strlen($term) >= 3 && !in_array(strtolower($term), ['the', 'all', 'a project', 'me', 'how'])) {
                $projects = Database::fetchAll("
                    SELECT id, project_title, project_progress_status, project_due_date, created_at
                    FROM projects
                    WHERE deleted_at IS NULL
                      AND (project_title LIKE :term OR project_address LIKE :term)
                    ORDER BY id DESC
                    LIMIT 8
                ", ['term' => "%{$term}%"]);

                if (count($projects) > 0) {
                    $reply = "### Found " . count($projects) . " matching project(s) for **\"{$term}\"**:\n\n";
                    foreach ($projects as $p) {
                        $reply .= "- **[#{$p['id']} - {$p['project_title']}](/projects/view/{$p['id']})**\n";
                        $reply .= "  - Status: `{$p['project_progress_status']}` | Due: " . ($p['project_due_date'] ? substr($p['project_due_date'], 0, 10) : 'None') . "\n";
                        $reply .= "  - [Open Project View](/projects/view/{$p['id']}) · [Edit Project](/projects/edit/{$p['id']})\n\n";
                    }
                    return ['reply' => $reply];
                }
            }
        }

        // 4. Compare / Summarize tracker records
        if (preg_match('/(?:compare|check|summary|report)\s+(?:tracker|activity|team|user)/i', $message)) {
            $today = date('Y-m-d');
            $topActive = Database::fetchAll("
                SELECT u.username, up.full_name,
                       COUNT(*) AS minutes_tracked,
                       SUM(a.clicks) AS clicks,
                       SUM(a.keystrokes) AS keystrokes,
                       SUM(CASE WHEN a.is_idle = 1 THEN 1 ELSE 0 END) AS idle_minutes
                FROM user_activities a
                JOIN users u ON u.id = a.user_id
                LEFT JOIN user_profiles up ON up.user_id = u.id
                WHERE DATE(a.tracked_at) = :date
                GROUP BY a.user_id
                ORDER BY minutes_tracked DESC
                LIMIT 5
            ", ['date' => $today]);

            if (empty($topActive)) {
                // Fallback to most recent activity date in database
                $recentDate = Database::fetchColumn("SELECT DATE(tracked_at) FROM user_activities ORDER BY id DESC LIMIT 1");
                if ($recentDate) {
                    $topActive = Database::fetchAll("
                        SELECT u.username, up.full_name,
                               COUNT(*) AS minutes_tracked,
                               SUM(a.clicks) AS clicks,
                               SUM(a.keystrokes) AS keystrokes,
                               SUM(CASE WHEN a.is_idle = 1 THEN 1 ELSE 0 END) AS idle_minutes
                        FROM user_activities a
                        JOIN users u ON u.id = a.user_id
                        LEFT JOIN user_profiles up ON up.user_id = u.id
                        WHERE DATE(a.tracked_at) = :date
                        GROUP BY a.user_id
                        ORDER BY minutes_tracked DESC
                        LIMIT 5
                    ", ['date' => $recentDate]);
                    $today = $recentDate;
                }
            }

            if (!empty($topActive)) {
                $reply = "### 📊 Team Activity Comparison Report ({$today}):\n\n";
                $reply .= "| Staff Member | Tracked Time | Active Time | Idle Time | Clicks | Keystrokes |\n";
                $reply .= "| :--- | :---: | :---: | :---: | :---: | :---: |\n";
                foreach ($topActive as $row) {
                    $name = $row['full_name'] ?: $row['username'];
                    $tracked = (int)$row['minutes_tracked'];
                    $idle = (int)$row['idle_minutes'];
                    $active = max(0, $tracked - $idle);
                    $reply .= "| **{$name}** | {$tracked} min | {$active} min | {$idle} min | " . number_format($row['clicks']) . " | " . number_format($row['keystrokes']) . " |\n";
                }
                $reply .= "\n*Data computed live from `user_activities` table.*";
                return ['reply' => $reply];
            }
        }

        return null;
    }

    /**
     * Call external AI provider (Gemini, Claude, ChatGPT, DeepSeek)
     */
    private function callAIProvider(string $provider, string $apiKey, string $model, string $prompt): array
    {
        if (empty($apiKey)) {
            return ['success' => false, 'error' => 'API Key is empty'];
        }

        try {
            switch ($provider) {
                case 'gemini':
                    $url = "https://generativelanguage.googleapis.com/v1beta/models/" . ($model ?: 'gemini-1.5-pro') . ":generateContent?key=" . urlencode($apiKey);
                    $data = [
                        'contents' => [
                            ['parts' => [['text' => $prompt]]]
                        ]
                    ];
                    $res = $this->httpPost($url, $data, ['Content-Type: application/json']);
                    if (isset($res['candidates'][0]['content']['parts'][0]['text'])) {
                        return ['success' => true, 'reply' => $res['candidates'][0]['content']['parts'][0]['text']];
                    }
                    return ['success' => false, 'error' => $res['error']['message'] ?? 'Gemini API Error'];

                case 'chatgpt':
                    $url = "https://api.openai.com/v1/chat/completions";
                    $data = [
                        'model' => $model ?: 'gpt-4o',
                        'messages' => [
                            ['role' => 'user', 'content' => $prompt]
                        ],
                        'temperature' => 0.7
                    ];
                    $res = $this->httpPost($url, $data, [
                        'Content-Type: application/json',
                        'Authorization: Bearer ' . $apiKey
                    ]);
                    if (isset($res['choices'][0]['message']['content'])) {
                        return ['success' => true, 'reply' => $res['choices'][0]['message']['content']];
                    }
                    return ['success' => false, 'error' => $res['error']['message'] ?? 'OpenAI API Error'];

                case 'claude':
                    $url = "https://api.anthropic.com/v1/messages";
                    $data = [
                        'model' => $model ?: 'claude-3-5-sonnet-20241022',
                        'max_tokens' => 2048,
                        'messages' => [
                            ['role' => 'user', 'content' => $prompt]
                        ]
                    ];
                    $res = $this->httpPost($url, $data, [
                        'Content-Type: application/json',
                        'x-api-key: ' . $apiKey,
                        'anthropic-version: 2023-06-01'
                    ]);
                    if (isset($res['content'][0]['text'])) {
                        return ['success' => true, 'reply' => $res['content'][0]['text']];
                    }
                    return ['success' => false, 'error' => $res['error']['message'] ?? 'Claude API Error'];

                case 'deepseek':
                    $url = "https://api.deepseek.com/chat/completions";
                    $data = [
                        'model' => $model ?: 'deepseek-chat',
                        'messages' => [
                            ['role' => 'user', 'content' => $prompt]
                        ],
                        'temperature' => 0.7
                    ];
                    $res = $this->httpPost($url, $data, [
                        'Content-Type: application/json',
                        'Authorization: Bearer ' . $apiKey
                    ]);
                    if (isset($res['choices'][0]['message']['content'])) {
                        return ['success' => true, 'reply' => $res['choices'][0]['message']['content']];
                    }
                    return ['success' => false, 'error' => $res['error']['message'] ?? 'DeepSeek API Error'];

                case 'groq':
                case 'grok':
                    $url = "https://api.groq.com/openai/v1/chat/completions";
                    if (str_starts_with($apiKey, 'xai-')) {
                        $url = "https://api.x.ai/v1/chat/completions";
                    }
                    $data = [
                        'model' => $model ?: 'openai/gpt-oss-120b',
                        'messages' => [
                            ['role' => 'user', 'content' => $prompt]
                        ],
                        'temperature' => 0.7
                    ];
                    $res = $this->httpPost($url, $data, [
                        'Content-Type: application/json',
                        'Authorization: Bearer ' . $apiKey
                    ]);
                    if (isset($res['choices'][0]['message']['content'])) {
                        return ['success' => true, 'reply' => $res['choices'][0]['message']['content']];
                    }
                    return ['success' => false, 'error' => $res['error']['message'] ?? 'Groq API Error'];

                default:
                    return ['success' => false, 'error' => "Unsupported provider: {$provider}"];
            }
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * HTTP POST helper
     */
    private function httpPost(string $url, array $data, array $headers): array
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $response = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            return ['error' => ['message' => "cURL Error: " . $err]];
        }

        return json_decode($response, true) ?: ['error' => ['message' => 'Invalid JSON response from provider']];
    }

    /**
     * System context builder with live ERP metrics & dynamic database retrieval
     */
    private function buildSystemContext(string $message, int $projectId = 0): string
    {
        $totalProjects = Database::fetchColumn("SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL") ?: 0;
        $totalUsers = Database::fetchColumn("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL") ?: 0;
        $totalClients = Database::fetchColumn("SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL") ?: 0;
        $totalActivities = Database::fetchColumn("SELECT COUNT(*) FROM user_activities") ?: 0;

        $liveDataContext = "";

        // 1. If a focused project ID was provided, build comprehensive project dossier
        if ($projectId > 0) {
            $proj = Database::fetch("SELECT * FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $projectId]);
            if ($proj) {
                // Fetch assigned clients
                $clients = Database::fetchAll("
                    SELECT c.id, c.name, c.title, c.client_type, c.email, c.phone, c.notes
                    FROM project_clients pc
                    JOIN clients c ON c.id = pc.client_id
                    WHERE pc.project_id = :pid
                ", ['pid' => $projectId]);

                // Fetch assigned team members
                $team = Database::fetchAll("
                    SELECT pt.user_id, pt.status, pt.points_gain,
                           u.username, up.full_name
                    FROM project_team_members pt
                    JOIN users u ON u.id = pt.user_id
                    LEFT JOIN user_profiles up ON up.user_id = u.id
                    WHERE pt.project_id = :pid AND pt.deleted_at IS NULL
                ", ['pid' => $projectId]);

                $due = $proj['project_due_date'] ? substr($proj['project_due_date'], 0, 10) : 'Not specified';
                $estimatorNotes = strip_tags($proj['project_estimator_notes'] ?? $proj['project_notes'] ?? 'None');
                $adminNotes = strip_tags($proj['project_admin_notes'] ?: 'None');
                $mainScope = strip_tags($proj['project_main_scope'] ?: 'None');
                $scopeDetails = strip_tags($proj['project_scope_details'] ?: 'None');
                $address = strip_tags($proj['project_address'] ?: 'Not specified');

                $liveDataContext .= "\n\n=== CURRENT FOCUSED PROJECT DOSSIER (Project ID #{$projectId}) ===\n";
                $liveDataContext .= "- Project Title: \"{$proj['project_title']}\"\n";
                $liveDataContext .= "- Progress Status: \"{$proj['project_progress_status']}\"\n";
                $liveDataContext .= "- Due Date: {$due}\n";
                $liveDataContext .= "- Site Address: {$address}\n";
                $liveDataContext .= "- Construction Type: " . ($proj['project_construction_type'] ?: 'N/A') . "\n";
                $liveDataContext .= "- Area / Pricing: " . ($proj['project_area'] ?: 'N/A') . " / " . ($proj['project_pricing'] ?: 'N/A') . "\n";
                $liveDataContext .= "- Main Scope: {$mainScope}\n";
                $liveDataContext .= "- Scope Details: {$scopeDetails}\n";
                $liveDataContext .= "- Estimator Notes: {$estimatorNotes}\n";
                $liveDataContext .= "- Admin Notes: {$adminNotes}\n";
                $liveDataContext .= "- Initial Drawings Link: " . ($proj['project_init_link'] ?: 'None') . "\n";
                $liveDataContext .= "- Final Deliverable Link: " . ($proj['project_final_link'] ?: 'None') . "\n";

                if (!empty($clients)) {
                    $liveDataContext .= "- Assigned Clients (" . count($clients) . "):\n";
                    foreach ($clients as $c) {
                        $roleType = ucfirst($c['client_type'] ?: 'Normal');
                        $cNotes = strip_tags($c['notes'] ?: 'None');
                        $liveDataContext .= "  * Client #{$c['id']}: \"{$c['name']}\" | Role: {$roleType} Client | Company/Title: {$c['title']} | Email: {$c['email']} | Notes: {$cNotes}\n";
                    }
                } else {
                    $liveDataContext .= "- Assigned Clients: None currently assigned.\n";
                }

                if (!empty($team)) {
                    $liveDataContext .= "- Assigned Project Team (" . count($team) . " members):\n";
                    foreach ($team as $m) {
                        $name = $m['full_name'] ?: $m['username'];
                        $liveDataContext .= "  * Staff: {$name} | Status: {$m['status']} | Points: {$m['points_gain']}\n";
                    }
                } else {
                    $liveDataContext .= "- Assigned Project Team: None currently assigned.\n";
                }
            }
        }

        // 2. Dynamic Project Retrieval (from query keywords if not restricted to single project)
        $stopWords = [
            'please', 'list', 'me', 'all', 'from', 'my', 'portal', 'that', 'name', 'title', 
            'round', 'about', 'and', 'its', 'status', 'what', 'are', 'show', 'find', 'get', 
            'the', 'with', 'project', 'projects', 'is', 'in', 'of', 'for', 'to', 'a', 'an'
        ];

        $words = preg_split('/[^a-zA-Z0-9_\-]+/', strtolower($message));
        $keywords = [];
        $statusFilter = null;

        $statusMap = [
            'delivered' => 'Deliver',
            'deliver' => 'Deliver',
            'completed' => 'Completed',
            'complete' => 'Completed',
            'pending' => 'Pending',
            'hold' => 'On Hold',
            'progress' => 'In Progress',
            'takeoff' => 'Takeoff',
            'planned' => 'Planned'
        ];

        foreach ($words as $w) {
            if (empty($w)) continue;
            if (isset($statusMap[$w])) {
                $statusFilter = $statusMap[$w];
                continue;
            }
            if (!in_array($w, $stopWords) && strlen($w) >= 3) {
                $keywords[] = $w;
            }
        }

        // Query database if relevant keywords or status present
        if (!empty($keywords) || !empty($statusFilter) || str_contains(strtolower($message), 'project')) {
            $where = ["deleted_at IS NULL"];
            $params = [];

            if ($statusFilter) {
                $where[] = "project_progress_status LIKE :status";
                $params['status'] = "%{$statusFilter}%";
            }

            if (!empty($keywords)) {
                $kwClauses = [];
                foreach ($keywords as $i => $kw) {
                    $kwClauses[] = "(project_title LIKE :kwt{$i} OR project_address LIKE :kwa{$i})";
                    $params["kwt{$i}"] = "%{$kw}%";
                    $params["kwa{$i}"] = "%{$kw}%";
                }
                $where[] = "(" . implode(" OR ", $kwClauses) . ")";
            }

            $sql = "SELECT id, project_title, project_progress_status, project_due_date, created_at 
                    FROM projects 
                    WHERE " . implode(" AND ", $where) . " 
                    ORDER BY id DESC 
                    LIMIT 25";
            $matchedProjects = Database::fetchAll($sql, $params);

            if (!empty($matchedProjects)) {
                $liveDataContext .= "\n\n=== LIVE ERP DATABASE SEARCH RESULTS (Projects Table) ===\n";
                $liveDataContext .= "Found " . count($matchedProjects) . " matching records in the portal database:\n";
                foreach ($matchedProjects as $p) {
                    $due = $p['project_due_date'] ? substr($p['project_due_date'], 0, 10) : 'None';
                    $liveDataContext .= "- Project ID #{$p['id']}: \"{$p['project_title']}\" | Status: \"{$p['project_progress_status']}\" | Due Date: {$due} | Direct View Link: /projects/view/{$p['id']} | Edit Link: /projects/edit/{$p['id']}\n";
                }
            }
        }

        // 3. Dynamic Team Tracker Retrieval (if queried)
        if (preg_match('/(?:tracker|activity|staff|working|hours|minutes|keystrokes)/i', $message)) {
            $recentActive = Database::fetchAll("
                SELECT u.username, up.full_name,
                       COUNT(*) AS minutes_tracked,
                       SUM(a.clicks) AS clicks,
                       SUM(a.keystrokes) AS keystrokes,
                       DATE(a.tracked_at) as work_date
                FROM user_activities a
                JOIN users u ON u.id = a.user_id
                LEFT JOIN user_profiles up ON up.user_id = u.id
                GROUP BY a.user_id, DATE(a.tracked_at)
                ORDER BY a.tracked_at DESC
                LIMIT 8
            ");
            if (!empty($recentActive)) {
                $liveDataContext .= "\n\n=== LIVE TRACKER ACTIVITY STATS (user_activities Table) ===\n";
                foreach ($recentActive as $row) {
                    $name = $row['full_name'] ?: $row['username'];
                    $liveDataContext .= "- User: {$name} | Date: {$row['work_date']} | Minutes: {$row['minutes_tracked']} | Clicks: {$row['clicks']} | Keystrokes: {$row['keystrokes']}\n";
                }
            }
        }

        return "You are an intelligent, highly advanced AI Assistant embedded inside the ERP Portal with DIRECT LIVE DATABASE ACCESS.

Current Portal System Overview:
- Projects: {$totalProjects} active
- Registered Clients: {$totalClients}
- Team Staff: {$totalUsers}
- Activity Tracker Records: " . number_format($totalActivities) . "
{$liveDataContext}

CRITICAL RULES & OPERATIONAL INSTRUCTIONS:
1. You HAVE real-time, live read access to the ERP database (the relevant portal records have been queried above specifically for the user's question).
2. NEVER tell the user that you don't have access to the database or that they should run a SQL query themselves.
3. ALWAYS answer using the live records provided above. When listing projects, format in a clean Markdown table with columns: ID, Project Title (as a clickable markdown link e.g. [Title](/projects/view/{id})), Status, and Due Date.
4. If a focused project dossier is provided above, answer questions specifically analyzing its scope, estimator notes, admin notes, assigned clients (distinguishing between Admin and Normal clients), team members, points, or deadlines.
5. If drafting client correspondence or status reports, write professional, polite, concise emails reflecting the project status and deliverables.
6. Security Guardrail: Data deletion is permanently disabled. Do not perform deletion.
7. PROJECT CREATION & UPDATES ARE FULLY AUTHORIZED: You ARE authorized and equipped to create and update projects directly in the ERP.
   - When the user asks you to create/add a project (even if only a title is provided or dummy content is requested), NEVER claim you cannot create records or ask them to go to a form. Confirm the creation enthusiastically and output the tag: `[[CREATE_PROJECT: {\"title\": \"<Project Title>\", \"status\": \"<Status or Pending>\", \"due_date\": \"<YYYY-MM-DD>\"}]]`.
   - When the user asks to update a project (e.g. status, title, due date), confirm the update and output the tag: `[[UPDATE_PROJECT: {\"id\": <ProjectId>, \"fields\": {\"project_progress_status\": \"<Status>\", \"project_title\": \"<New Title>\", \"project_due_date\": \"<YYYY-MM-DD>\"}}]]`.
   - The ERP backend automatically intercepts these tags and immediately executes the database write in real time, returning interactive view and edit links to the user.";
    }

    /**
     * Local intelligent fallback reply
     */
    private function generateLocalAssistantReply(string $message, string $provider, ?string $apiError, int $projectId = 0): string
    {
        if ($projectId > 0) {
            $proj = Database::fetch("SELECT * FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $projectId]);
            if ($proj) {
                $clients = Database::fetchAll("
                    SELECT c.id, c.name, c.title, c.client_type, c.notes
                    FROM project_clients pc
                    JOIN clients c ON c.id = pc.client_id
                    WHERE pc.project_id = :pid
                ", ['pid' => $projectId]);

                $team = Database::fetchAll("
                    SELECT pt.status, pt.points_gain,
                           u.username, up.full_name
                    FROM project_team_members pt
                    JOIN users u ON u.id = pt.user_id
                    LEFT JOIN user_profiles up ON up.user_id = u.id
                    WHERE pt.project_id = :pid AND pt.deleted_at IS NULL
                ", ['pid' => $projectId]);

                $clientNames = !empty($clients)
                    ? implode(', ', array_map(fn($c) => "{$c['name']} (" . ucfirst($c['client_type'] ?: 'Normal') . ")", $clients))
                    : 'None assigned';

                $teamSummary = !empty($team)
                    ? implode(', ', array_map(fn($t) => ($t['full_name'] ?: $t['username']) . " ({$t['status']}, {$t['points_gain']} pts)", $team))
                    : 'None assigned';

                $due = $proj['project_due_date'] ? substr($proj['project_due_date'], 0, 10) : 'Not specified';
                $estimatorNotes = strip_tags($proj['project_estimator_notes'] ?? $proj['project_notes'] ?? 'None');
                $adminNotes = strip_tags($proj['project_admin_notes'] ?: 'None');
                $scope = strip_tags($proj['project_main_scope'] ?: 'None');

                return "### 🤖 Project Assistant: {$proj['project_title']} (ID #{$projectId})\n\n"
                    . "**Quick Project Summary:**\n"
                    . "- **Status:** `{$proj['project_progress_status']}`\n"
                    . "- **Due Date:** {$due}\n"
                    . "- **Assigned Clients:** {$clientNames}\n"
                    . "- **Assigned Team:** {$teamSummary}\n"
                    . "- **Main Scope:** {$scope}\n"
                    . "- **Estimator Notes:** {$estimatorNotes}\n"
                    . "- **Admin Notes:** {$adminNotes}\n\n"
                    . "*Tip: Ask me to draft client updates, review scope details, or check team points allocation.*";
            }
        }

        $totalProjects = Database::fetchColumn("SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL") ?: 0;
        $totalUsers = Database::fetchColumn("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL") ?: 0;

        $notice = "";
        if (!empty($apiError)) {
            $notice = "\n\n*(Note: Provider `" . ucfirst($provider) . "` API returned: `{$apiError}`. Please update your API key in Settings > AI Models).*";
        }

        return "### 🤖 ERP Assistant\n\nI received your query: *\"{$message}\"*.\n\nCurrently, our ERP workspace has **{$totalProjects} projects** and **{$totalUsers} team members**. You can ask me to:\n- **Find projects** by title (e.g., *\"find project iron wolf\"*)\n- **Compare team tracker stats** (e.g., *\"compare tracker records today\"*)\n- **Generate project breakdown reports**\n\nTo activate direct cloud inference with **" . ucfirst($provider) . "**, make sure you configure a valid API key in [Settings > AI Models](/settings/ai-models).{$notice}";
    }
}

