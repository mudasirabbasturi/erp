<?php
namespace App\Services;

use Core\Database;
use ZipArchive;

class AIEngineService
{
    private const STOPWORDS = [
        'the', 'a', 'an', 'and', 'or', 'for', 'of', 'in', 'on', 'to', 'by', 'with',
        'is', 'are', 'was', 'were', 'be', 'been', 'what', 'which', 'who', 'where',
        'when', 'how', 'show', 'find', 'get', 'give', 'tell', 'me', 'about', 'all',
        'list', 'view', 'please', 'can', 'you', 'could', 'would', 'project', 'projects',
        'client', 'clients', 'user', 'users', 'staff', 'member', 'members', 'team',
        'report', 'export', 'pdf', 'excel', 'xlsx', 'csv', 'summary', 'details',
        'info', 'information', 'data', 'record', 'records', 'status', 'check', 'look',
        'search', 'generate', 'create', 'make', 'download', 'file', 'sheet'
    ];

    /**
     * Entry point for AI Assistant chat with attachments, fuzzy DB engine, and native tool calling.
     */
    public function handleChat(
        string $message,
        int $conversationId,
        int $projectId,
        int $userId,
        array $attachments = []
    ): array {
        // 1. Load Active Provider & Guardrails
        $activeSetting = Database::fetch("SELECT `value` FROM `system_settings` WHERE `key` = 'ai_active_provider'");
        $provider = $activeSetting ? $activeSetting['value'] : 'groq';

        $providerSetting = Database::fetch("SELECT `value` FROM `system_settings` WHERE `key` = :k", ['k' => "ai_provider_{$provider}"]);
        $pConfig = $providerSetting ? (json_decode($providerSetting['value'], true) ?: []) : [];
        $apiKey = trim((string)($pConfig['api_key'] ?? ''));
        $model = trim((string)($pConfig['model'] ?? $this->defaultModelForProvider($provider)));
        $temperature = isset($pConfig['temperature']) ? (float)$pConfig['temperature'] : 0.4;

        $guardrails = $this->loadGuardrails();

        // 2. Check strict delete guardrail up front
        if (preg_match('/\b(delete|drop|truncate|remove|purge|destroy|wipe)\b\s+(all\s+)?(projects?|clients?|users?|records?|table|database|data)\b/i', $message)
            && !preg_match('/\b(not delete|don\'?t delete|blocked)\b/i', $message)) {
            $blockedReply = "⛔ **Action Blocked by Security Policy**\n\nPermanent deletion (`DELETE`, `DROP`, `TRUNCATE`, or purging ERP records) is strictly forbidden for the AI Assistant. You can archive or update project status to `Cancelled` instead if Edit permission is enabled.";
            return [
                'reply' => $blockedReply,
                'provider' => $provider,
                'model' => $model,
                'attachments_saved' => []
            ];
        }

        // 3. Process Attachments (text extraction + multimodal base64 payloads)
        $processedAttachments = $this->processUploadedAttachments($attachments);
        $attachmentPromptBlock = $this->buildAttachmentTextBlock($processedAttachments);

        // 4. Load Recent Conversation History (last 8 turns excluding the just-saved user message)
        $historyRows = [];
        if ($conversationId > 0) {
            $rows = Database::fetchAll(
                "SELECT role, content FROM ai_messages WHERE conversation_id = :cid ORDER BY id DESC LIMIT 9",
                ['cid' => $conversationId]
            );
            $rows = array_reverse($rows);
            // Drop the trailing user message since we already saved it before calling engine
            if (!empty($rows) && end($rows)['role'] === 'user') {
                array_pop($rows);
            }
            $historyRows = $rows;
        }

        // 5. Build Rich System Prompt + Fuzzy Pre-Context (guarantees high accuracy even for simple queries)
        $systemPrompt = $this->buildSystemPrompt($projectId, $guardrails);
        $fuzzyContext = $this->buildPreFetchedContext($message, $projectId, $guardrails);

        $effectiveUserMessage = trim($message);
        if ($attachmentPromptBlock !== '') {
            $effectiveUserMessage .= "\n\n" . $attachmentPromptBlock;
        }

        if (empty($apiKey)) {
            $fallback = $this->generateSmartLocalFallback($message, $provider, 'No API key configured for ' . strtoupper($provider), $projectId, $guardrails);
            return [
                'reply' => $fallback,
                'provider' => $provider,
                'model' => $model,
                'attachments_saved' => $processedAttachments
            ];
        }

        // 6. Execute Provider Tool-Calling Loop
        $tools = $this->getToolDefinitions($guardrails);
        $result = $this->executeProviderLoop(
            $provider,
            $apiKey,
            $model,
            $temperature,
            $systemPrompt,
            $fuzzyContext,
            $historyRows,
            $effectiveUserMessage,
            $processedAttachments,
            $tools,
            $guardrails,
            $projectId
        );

        if ($result['success']) {
            return [
                'reply' => $result['reply'],
                'provider' => $provider,
                'model' => $model,
                'attachments_saved' => $processedAttachments
            ];
        }

        $fallback = $this->generateSmartLocalFallback($message, $provider, $result['error'] ?? 'API request failed', $projectId, $guardrails);
        return [
            'reply' => $fallback,
            'provider' => $provider,
            'model' => $model,
            'attachments_saved' => $processedAttachments
        ];
    }

    /**
     * Load AI guardrails with DELETE hardcoded to false.
     */
    public function loadGuardrails(): array
    {
        $rows = Database::fetchAll("SELECT `key`, `value` FROM `system_settings` WHERE `key` LIKE 'ai_guardrail_%'");
        $g = ['read' => true, 'add' => true, 'edit' => true, 'delete' => false];
        foreach ($rows as $r) {
            if ($r['key'] === 'ai_guardrail_read') $g['read'] = ($r['value'] === '1');
            if ($r['key'] === 'ai_guardrail_add') $g['add'] = ($r['value'] === '1');
            if ($r['key'] === 'ai_guardrail_edit') $g['edit'] = ($r['value'] === '1');
        }
        $g['delete'] = false; // Permanently locked
        return $g;
    }

    private function defaultModelForProvider(string $provider): string
    {
        return match ($provider) {
            'gemini' => 'gemini-2.5-flash',
            'claude' => 'claude-3-7-sonnet-20250219',
            'chatgpt' => 'gpt-4o',
            'deepseek' => 'deepseek-chat',
            'groq' => 'llama-3.3-70b-versatile',
            default => 'gemini-2.5-flash',
        };
    }

    // =========================================================================
    // FUZZY / TYPO-TOLERANT DATABASE SEARCH ENGINE
    // =========================================================================

    public static function normalizeText(?string $text): string
    {
        if ($text === null || $text === '') return '';
        $plain = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if (function_exists('iconv')) {
            $trans = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $plain);
            if ($trans !== false && $trans !== '') {
                $plain = $trans;
            }
        }
        $plain = mb_strtolower($plain, 'UTF-8');
        $plain = preg_replace('/[^a-z0-9\s]+/u', ' ', $plain);
        return trim(preg_replace('/\s+/', ' ', $plain));
    }

    public static function cleanPlainText(?string $text, int $maxLen = 600): string
    {
        if ($text === null || $text === '') return '';
        $plain = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
        if (mb_strlen($plain) > $maxLen) {
            return mb_substr($plain, 0, $maxLen) . '...';
        }
        return $plain;
    }

    private function extractKeywords(string $query): array
    {
        $norm = self::normalizeText($query);
        if ($norm === '') return [];
        $parts = explode(' ', $norm);
        $tokens = [];
        foreach ($parts as $p) {
            if ($p === '') continue;
            if (is_numeric($p) || (!in_array($p, self::STOPWORDS, true) && mb_strlen($p) >= 2)) {
                $tokens[] = $p;
            }
        }
        return array_values(array_unique($tokens));
    }

    /**
     * Scores a searchable blob against query string + keywords using exact + Levenshtein + similar_text.
     */
    private function scoreFuzzyMatch(string $normQuery, array $keywords, string $rawHaystack, string $primaryField = ''): int
    {
        $hay = self::normalizeText($rawHaystack);
        $prim = self::normalizeText($primaryField);
        if ($hay === '') return 0;

        $score = 0;

        // 1. Exact full query substring match
        if ($normQuery !== '' && mb_strlen($normQuery) >= 3) {
            if ($prim !== '' && str_contains($prim, $normQuery)) {
                $score += 140;
            } elseif (str_contains($hay, $normQuery)) {
                $score += 90;
            }
        }

        if (empty($keywords)) return $score;

        $hayWords = array_values(array_unique(array_filter(explode(' ', $hay), fn($w) => $w !== '')));
        $primWords = $prim !== '' ? array_values(array_unique(array_filter(explode(' ', $prim), fn($w) => $w !== ''))) : [];

        $matchedTokens = 0;
        foreach ($keywords as $kw) {
            $tokenScore = 0;

            // Exact substring match in primary title/name
            if ($prim !== '' && str_contains($prim, $kw)) {
                $tokenScore = 60;
            } elseif (str_contains($hay, $kw)) {
                $tokenScore = 38;
            } else {
                // Fuzzy word-level typo check (e.g., "canadain" ~ "canadian", "rehn" ~ "rehan", "irn" ~ "iron")
                $kwLen = strlen($kw);
                if ($kwLen >= 3) {
                    $maxDist = $kwLen >= 7 ? 2 : 1;
                    $bestWordScore = 0;

                    foreach ($hayWords as $hw) {
                        $hwLen = strlen($hw);
                        if ($hwLen < 2) continue;

                        // Prefix / consonant skeleton similarity
                        if ($kwLen >= 4 && str_starts_with($hw, substr($kw, 0, 3))) {
                            similar_text($kw, $hw, $pct);
                            if ($pct >= 68) {
                                $s = in_array($hw, $primWords, true) ? 40 : 26;
                                if ($s > $bestWordScore) $bestWordScore = $s;
                            }
                        }

                        if (abs($kwLen - $hwLen) <= $maxDist) {
                            $dist = levenshtein($kw, $hw);
                            if ($dist <= $maxDist) {
                                $s = in_array($hw, $primWords, true) ? 45 : 30;
                                if ($s > $bestWordScore) $bestWordScore = $s;
                            }
                        } else {
                            similar_text($kw, $hw, $pct);
                            if ($pct >= 78) {
                                $s = in_array($hw, $primWords, true) ? 35 : 22;
                                if ($s > $bestWordScore) $bestWordScore = $s;
                            }
                        }
                    }
                    $tokenScore = $bestWordScore;
                }
            }

            if ($tokenScore > 0) {
                $matchedTokens++;
                $score += $tokenScore;
            }
        }

        // Bonus when ALL keywords matched
        if ($matchedTokens === count($keywords) && count($keywords) > 1) {
            $score += 45;
        }

        return $score;
    }

    /**
     * Fuzzy status normalizer (handles typos like "pendng", "completed", "HOLD", "late")
     */
    private function matchStatusFilter(string $rowStatus, string $filter): bool
    {
        $f = self::normalizeText($filter);
        $s = self::normalizeText($rowStatus);
        if ($f === '' || $f === 'all') return true;
        if ($s === '') return false;
        if (str_contains($s, $f) || str_contains($f, $s)) return true;
        similar_text($f, $s, $pct);
        return $pct >= 72 || levenshtein($f, $s) <= 2;
    }

    /**
     * Multi-module fuzzy ERP search across projects, clients, users, and takeoff_sessions.
     */
    public function fuzzySearchErp(string $query = '', string $module = 'all', string $statusFilter = '', int $limit = 15): array
    {
        $limit = max(1, min(50, $limit));
        $normQuery = self::normalizeText($query);
        $keywords = $this->extractKeywords($query);
        $directId = null;
        if (preg_match('/^#?(\d+)$/', trim($query), $idm)) {
            $directId = (int)$idm[1];
        } elseif (preg_match('/#(\d+)/', $query, $idm)) {
            $directId = (int)$idm[1];
        }

        $results = [
            'projects' => [],
            'clients' => [],
            'users' => [],
            'takeoff_sessions' => [],
        ];

        // 1. Projects (lightweight full-table scan so older projects among thousands are NEVER missed)
        if ($module === 'all' || $module === 'projects') {
            $rows = Database::fetchAll("
                SELECT p.id, p.project_title, p.project_address, p.project_construction_type,
                       p.project_progress_status, p.project_due_date, p.project_points,
                       p.project_pricing, p.project_total_budget, p.project_area,
                       p.project_main_scope, p.is_project_late,
                       c.name AS primary_client_name
                FROM projects p
                LEFT JOIN clients c ON c.id = p.client_id
                WHERE p.deleted_at IS NULL
                ORDER BY p.id DESC
            ");

            $scored = [];
            foreach ($rows as $r) {
                if ($statusFilter !== '') {
                    if ($statusFilter === 'late') {
                        if ((int)$r['is_project_late'] !== 1) continue;
                    } elseif (!$this->matchStatusFilter((string)$r['project_progress_status'], $statusFilter)) {
                        continue;
                    }
                }

                $haystack = implode(' ', [
                    $r['id'],
                    $r['project_title'] ?? '',
                    $r['project_address'] ?? '',
                    $r['project_construction_type'] ?? '',
                    $r['project_progress_status'] ?? '',
                    $r['project_main_scope'] ?? '',
                    $r['primary_client_name'] ?? '',
                ]);

                if ($directId !== null && (int)$r['id'] === $directId) {
                    $score = 500;
                } elseif (empty($keywords) && $normQuery === '') {
                    $score = 10;
                } else {
                    $score = $this->scoreFuzzyMatch($normQuery, $keywords, $haystack, (string)$r['project_title']);
                }

                if ($score > 0) {
                    $scored[(int)$r['id']] = ['id' => (int)$r['id'], 'score' => $score];
                }
            }

            // Secondary SQL LIKE check inside scope/notes HTML blobs if fewer than $limit found and keywords exist
            if (count($scored) < $limit && !empty($keywords)) {
                $kwLike = '%' . $keywords[0] . '%';
                $noteHits = Database::fetchAll("
                    SELECT p.id
                    FROM projects p
                    WHERE p.deleted_at IS NULL
                      AND (p.project_scope_details LIKE :k1 OR p.project_estimator_notes LIKE :k2 OR p.project_admin_notes LIKE :k3)
                    ORDER BY p.id DESC
                    LIMIT 30
                ", ['k1' => $kwLike, 'k2' => $kwLike, 'k3' => $kwLike]);
                foreach ($noteHits as $nh) {
                    $nhId = (int)$nh['id'];
                    if (!isset($scored[$nhId])) {
                        $scored[$nhId] = ['id' => $nhId, 'score' => 25];
                    }
                }
            }

            $scoredList = array_values($scored);
            usort($scoredList, fn($a, $b) => $b['score'] <=> $a['score'] ?: $b['id'] <=> $a['id']);
            $topWinners = array_slice($scoredList, 0, $limit);

            if (!empty($topWinners)) {
                $scoreMap = [];
                $winnerIds = [];
                foreach ($topWinners as $w) {
                    $winnerIds[] = $w['id'];
                    $scoreMap[$w['id']] = $w['score'];
                }
                $inClause = implode(',', $winnerIds);
                $fullRows = Database::fetchAll("
                    SELECT p.id, p.project_title, p.project_address, p.project_construction_type,
                           p.project_progress_status, p.project_due_date, p.project_points,
                           p.project_pricing, p.project_total_budget, p.project_area,
                           p.project_main_scope, p.project_scope_details,
                           p.project_admin_notes, p.project_estimator_notes,
                           p.project_init_link, p.project_final_link, p.is_project_late,
                           c.name AS primary_client_name
                    FROM projects p
                    LEFT JOIN clients c ON c.id = p.client_id
                    WHERE p.id IN ({$inClause})
                ");
                foreach ($fullRows as &$fr) {
                    $fr['match_score'] = $scoreMap[(int)$fr['id']] ?? 10;
                    $fr['project_scope_details'] = self::cleanPlainText($fr['project_scope_details'] ?? '', 300);
                    $fr['project_estimator_notes'] = self::cleanPlainText($fr['project_estimator_notes'] ?? '', 250);
                    $fr['project_admin_notes'] = self::cleanPlainText($fr['project_admin_notes'] ?? '', 250);
                }
                usort($fullRows, fn($a, $b) => $b['match_score'] <=> $a['match_score'] ?: $b['id'] <=> $a['id']);
                $results['projects'] = $fullRows;
            }
        }

        // 2. Clients (full lightweight scan)
        if ($module === 'all' || $module === 'clients') {
            $rows = Database::fetchAll("
                SELECT id, title, name, email, phone, address, city, state, country, client_type, notes
                FROM clients
                WHERE deleted_at IS NULL
                ORDER BY id DESC
            ");

            $scored = [];
            foreach ($rows as $r) {
                $haystack = implode(' ', [
                    $r['id'], $r['name'] ?? '', $r['title'] ?? '', $r['email'] ?? '',
                    $r['phone'] ?? '', $r['city'] ?? '', $r['state'] ?? '',
                    $r['country'] ?? '', $r['client_type'] ?? '', $r['notes'] ?? ''
                ]);
                $score = ($directId !== null && (int)$r['id'] === $directId)
                    ? 500
                    : ((empty($keywords) && $normQuery === '') ? 10 : $this->scoreFuzzyMatch($normQuery, $keywords, $haystack, (string)($r['name'] ?? $r['title'] ?? '')));

                if ($score > 0) {
                    $r['match_score'] = $score;
                    $scored[] = $r;
                }
            }
            usort($scored, fn($a, $b) => $b['match_score'] <=> $a['match_score'] ?: $b['id'] <=> $a['id']);
            $results['clients'] = array_slice($scored, 0, $limit);
        }

        // 3. Users / Staff
        if ($module === 'all' || $module === 'users') {
            $rows = Database::fetchAll("
                SELECT u.id, u.username, u.email, u.status, u.wfh_allowed, u.last_active_at,
                       p.full_name, p.phone, r.name AS role_name
                FROM users u
                LEFT JOIN user_profiles p ON p.user_id = u.id
                LEFT JOIN roles r ON r.id = u.role_id
                WHERE u.deleted_at IS NULL
                ORDER BY u.id ASC
                LIMIT 250
            ");

            $scored = [];
            foreach ($rows as $r) {
                if ($statusFilter !== '' && !$this->matchStatusFilter((string)$r['status'], $statusFilter)) {
                    continue;
                }
                $haystack = implode(' ', [
                    $r['id'], $r['username'] ?? '', $r['full_name'] ?? '',
                    $r['email'] ?? '', $r['role_name'] ?? '', $r['status'] ?? ''
                ]);
                $score = ($directId !== null && (int)$r['id'] === $directId)
                    ? 500
                    : ((empty($keywords) && $normQuery === '') ? 10 : $this->scoreFuzzyMatch($normQuery, $keywords, $haystack, (string)(($r['full_name'] ?? '') . ' ' . ($r['username'] ?? ''))));

                if ($score > 0) {
                    $r['match_score'] = $score;
                    $scored[] = $r;
                }
            }
            usort($scored, fn($a, $b) => $b['match_score'] <=> $a['match_score'] ?: $a['id'] <=> $b['id']);
            $results['users'] = array_slice($scored, 0, $limit);
        }

        // 4. Takeoff Sessions
        if ($module === 'all' || $module === 'takeoff') {
            $rows = Database::fetchAll("
                SELECT ts.id, ts.project_id, ts.name, ts.description, ts.status, ts.created_at,
                       p.project_title,
                       (SELECT COUNT(*) FROM takeoff_measurements tm WHERE tm.session_id = ts.id AND tm.deleted_at IS NULL) AS measurement_count
                FROM takeoff_sessions ts
                LEFT JOIN projects p ON p.id = ts.project_id
                WHERE ts.deleted_at IS NULL
                ORDER BY ts.id DESC
                LIMIT 200
            ");

            $scored = [];
            foreach ($rows as $r) {
                $haystack = implode(' ', [
                    $r['id'], $r['project_id'] ?? '', $r['name'] ?? '',
                    $r['description'] ?? '', $r['project_title'] ?? '', $r['status'] ?? ''
                ]);
                $score = ($directId !== null && (int)$r['id'] === $directId)
                    ? 500
                    : ((empty($keywords) && $normQuery === '') ? 10 : $this->scoreFuzzyMatch($normQuery, $keywords, $haystack, (string)(($r['name'] ?? '') . ' ' . ($r['project_title'] ?? ''))));

                if ($score > 0) {
                    $r['match_score'] = $score;
                    $scored[] = $r;
                }
            }
            usort($scored, fn($a, $b) => $b['match_score'] <=> $a['match_score'] ?: $b['id'] <=> $a['id']);
            $results['takeoff_sessions'] = array_slice($scored, 0, $limit);
        }

        return $results;
    }

    // =========================================================================
    // ERP TOOL IMPLEMENTATIONS (CALLED BY LLM TOOLS OR DIRECT ACTIONS)
    // =========================================================================

    public function toolGetProjectFullDetails(string $projectIdOrTitle): array
    {
        $pid = 0;
        if (is_numeric(trim($projectIdOrTitle))) {
            $pid = (int)$projectIdOrTitle;
        } elseif (preg_match('/#(\d+)/', $projectIdOrTitle, $m)) {
            $pid = (int)$m[1];
        }

        $proj = null;
        if ($pid > 0) {
            $proj = Database::fetch("SELECT * FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $pid]);
        }
        if (!$proj) {
            $found = $this->fuzzySearchErp($projectIdOrTitle, 'projects', '', 3);
            if (!empty($found['projects'])) {
                $pid = (int)$found['projects'][0]['id'];
                $proj = Database::fetch("SELECT * FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $pid]);
            }
        }

        if (!$proj) {
            return ['found' => false, 'message' => "No project matching '{$projectIdOrTitle}' found."];
        }

        // Clean HTML descriptions
        foreach (['project_scope_details', 'project_admin_notes', 'project_estimator_notes', 'project_line_items_pricing'] as $col) {
            if (!empty($proj[$col])) {
                $proj[$col . '_text'] = self::cleanPlainText($proj[$col], 2000);
            }
        }

        // Clients (project_clients + legacy client_id)
        $clients = Database::fetchAll("
            SELECT DISTINCT c.id, c.name, c.title, c.email, c.phone, c.city, c.state, c.country, c.client_type
            FROM clients c
            LEFT JOIN project_clients pc ON pc.client_id = c.id AND pc.project_id = :pid1
            WHERE c.deleted_at IS NULL AND (pc.project_id IS NOT NULL OR c.id = :cid)
        ", ['pid1' => $pid, 'cid' => (int)($proj['client_id'] ?? 0)]);

        // Team Members
        $team = Database::fetchAll("
            SELECT u.id AS user_id, u.username, p.full_name, u.email,
                   ptm.steps, ptm.status AS member_status, ptm.points_gain, ptm.notes,
                   ptm.started_at, ptm.completed_at
            FROM project_team_members ptm
            JOIN users u ON u.id = ptm.user_id
            LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE ptm.project_id = :pid AND ptm.deleted_at IS NULL
        ", ['pid' => $pid]);

        // Takeoff Sessions & Measurements summary
        $sessions = Database::fetchAll("
            SELECT ts.id, ts.name, ts.status, ts.created_at,
                   (SELECT COUNT(*) FROM takeoff_measurements tm WHERE tm.session_id = ts.id AND tm.deleted_at IS NULL) AS measurements_count
            FROM takeoff_sessions ts
            WHERE ts.project_id = :pid AND ts.deleted_at IS NULL
        ", ['pid' => $pid]);

        return [
            'found' => true,
            'project' => $proj,
            'clients' => $clients,
            'team_members' => $team,
            'takeoff_sessions' => $sessions
        ];
    }

    public function toolGetTeamActivityReport(string $userQuery = '', string $dateFrom = '', string $dateTo = ''): array
    {
        if ($dateFrom === '') $dateFrom = date('Y-m-d', strtotime('-1 day'));
        if ($dateTo === '') $dateTo = date('Y-m-d');

        $targetUserIds = [];
        $matchedUsers = [];
        if (trim($userQuery) !== '') {
            $search = $this->fuzzySearchErp($userQuery, 'users', '', 5);
            $matchedUsers = $search['users'];
            $targetUserIds = array_map(fn($u) => (int)$u['id'], $matchedUsers);
        }

        $where = "DATE(ua.tracked_at) BETWEEN :d1 AND :d2";
        $params = ['d1' => $dateFrom, 'd2' => $dateTo];

        if (!empty($targetUserIds)) {
            $in = implode(',', array_map('intval', $targetUserIds));
            $where .= " AND ua.user_id IN ({$in})";
        }

        $summary = Database::fetchAll("
            SELECT ua.user_id, u.username, COALESCE(p.full_name, u.username) AS full_name,
                   COUNT(*) AS total_logs,
                   SUM(CASE WHEN ua.is_idle = 0 THEN 1 ELSE 0 END) AS active_logs,
                   SUM(CASE WHEN ua.is_idle = 1 THEN 1 ELSE 0 END) AS idle_logs,
                   SUM(ua.clicks) AS total_clicks,
                   SUM(ua.keystrokes) AS total_keystrokes,
                   MIN(ua.tracked_at) AS first_seen,
                   MAX(ua.tracked_at) AS last_seen
            FROM user_activities ua
            JOIN users u ON u.id = ua.user_id
            LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE {$where}
            GROUP BY ua.user_id, u.username, p.full_name
            ORDER BY total_logs DESC
            LIMIT 25
        ", $params);

        $topApps = [];
        if (!empty($targetUserIds) || count($summary) === 1) {
            $uid = !empty($targetUserIds) ? $targetUserIds[0] : (int)($summary[0]['user_id'] ?? 0);
            if ($uid > 0) {
                $topApps = Database::fetchAll("
                    SELECT app_name, window_title, COUNT(*) AS hits, SUM(clicks) AS clicks, SUM(keystrokes) AS keystrokes
                    FROM user_activities
                    WHERE user_id = :uid AND DATE(tracked_at) BETWEEN :d1 AND :d2
                    GROUP BY app_name, window_title
                    ORDER BY hits DESC
                    LIMIT 12
                ", ['uid' => $uid, 'd1' => $dateFrom, 'd2' => $dateTo]);
            }
        }

        return [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'matched_users' => $matchedUsers,
            'activity_summary' => $summary,
            'top_apps' => $topApps
        ];
    }

    /**
     * Strictly read-only SQL executor (SELECT only, blocks sensitive fields and writes).
     */
    public function toolRunSafeSqlSelect(string $sql): array
    {
        $clean = trim($sql);
        $clean = rtrim($clean, '; ');
        if ($clean === '' || !preg_match('/^SELECT\b/i', $clean)) {
            return ['error' => 'Only single read-only SELECT statements are permitted.'];
        }
        if (str_contains($clean, ';')) {
            return ['error' => 'Multiple SQL statements are not allowed.'];
        }
        if (preg_match('/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|CREATE|GRANT|REVOKE|INTO\s+OUTFILE|INTO\s+DUMPFILE|LOAD_FILE|SLEEP|BENCHMARK)\b/i', $clean)) {
            return ['error' => 'Forbidden SQL keyword detected. Only read-only SELECT queries are permitted.'];
        }
        if (preg_match('/\b(password_hash|api_key|token_hash|ai_provider_)\b/i', $clean)) {
            return ['error' => 'Access to credential or API key columns is restricted.'];
        }

        if (!preg_match('/\bLIMIT\s+\d+/i', $clean)) {
            $clean .= ' LIMIT 50';
        }

        try {
            $rows = Database::fetchAll($clean);
            foreach ($rows as &$r) {
                unset($r['password_hash'], $r['api_key'], $r['token']);
                foreach ($r as $k => $v) {
                    if (is_string($v) && strlen($v) > 500) {
                        $r[$k] = self::cleanPlainText($v, 350);
                    }
                }
            }
            return ['row_count' => count($rows), 'rows' => array_slice($rows, 0, 50)];
        } catch (\Throwable $e) {
            return ['error' => 'SQL execution error: ' . $e->getMessage()];
        }
    }

    /**
     * Generates a native OOXML .xlsx spreadsheet (with styled headers) in public/uploads/ai_exports/.
     */
    public function toolExportExcelReport(
        string $title = 'ERP Data Export',
        string $module = 'projects',
        string $statusFilter = '',
        string $keyword = ''
    ): array {
        $title = trim($title) !== '' ? trim($title) : 'ERP Data Export';
        [$headers, $rows] = $this->gatherTabularReportData($module, $statusFilter, $keyword, '');

        $dir = dirname(__DIR__, 2) . '/public/uploads/ai_exports';
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $slug = preg_replace('/[^a-z0-9]+/i', '_', strtolower($title));
        $slug = trim($slug, '_') ?: 'erp_export';
        $baseName = $slug . '_' . date('Ymd_His') . '_' . substr(bin2hex(random_bytes(3)), 0, 6);

        $xlsxPath = $dir . '/' . $baseName . '.xlsx';
        $built = $this->buildXlsxFile($xlsxPath, $title, $headers, $rows);

        if ($built && file_exists($xlsxPath)) {
            $url = '/uploads/ai_exports/' . $baseName . '.xlsx';
            return [
                'success' => true,
                'format' => 'xlsx',
                'filename' => $baseName . '.xlsx',
                'row_count' => count($rows),
                'download_url' => $url,
                'markdown_link' => "[Download Excel Report: {$title} ({$baseName}.xlsx)]({$url})"
            ];
        }

        // CSV fallback
        $csvPath = $dir . '/' . $baseName . '.csv';
        $fp = fopen($csvPath, 'w');
        fwrite($fp, "\xEF\xBB\xBF");
        fputcsv($fp, $headers);
        foreach ($rows as $row) {
            fputcsv($fp, $row);
        }
        fclose($fp);

        $url = '/uploads/ai_exports/' . $baseName . '.csv';
        return [
            'success' => true,
            'format' => 'csv',
            'filename' => $baseName . '.csv',
            'row_count' => count($rows),
            'download_url' => $url,
            'markdown_link' => "[Download CSV Report: {$title} ({$baseName}.csv)]({$url})"
        ];
    }

    /**
     * Generates a clean multi-page binary PDF 1.4 report in public/uploads/ai_exports/.
     */
    public function toolGeneratePdfReport(
        string $title = 'ERP Executive Report',
        string $module = 'projects',
        string $projectIdOrTitle = '',
        string $statusFilter = '',
        string $keyword = '',
        string $summaryNote = ''
    ): array {
        $title = trim($title) !== '' ? trim($title) : 'ERP Executive Report';
        [$headers, $rows, $subtitle] = $this->gatherTabularReportData($module, $statusFilter, $keyword, $projectIdOrTitle);

        $dir = dirname(__DIR__, 2) . '/public/uploads/ai_exports';
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $slug = preg_replace('/[^a-z0-9]+/i', '_', strtolower($title));
        $slug = trim($slug, '_') ?: 'erp_report';
        $filename = $slug . '_' . date('Ymd_His') . '_' . substr(bin2hex(random_bytes(3)), 0, 6) . '.pdf';
        $pdfPath = $dir . '/' . $filename;

        $this->buildPurePhpPdf($pdfPath, $title, $subtitle, $summaryNote, $headers, $rows);

        $url = '/uploads/ai_exports/' . $filename;
        return [
            'success' => file_exists($pdfPath),
            'format' => 'pdf',
            'filename' => $filename,
            'row_count' => count($rows),
            'download_url' => $url,
            'markdown_link' => "[Download PDF Report: {$title}]({$url})"
        ];
    }

    /**
     * Generates an AI image via OpenAI DALL-E 3 or Gemini Imagen using configured DB keys.
     */
    public function toolGenerateImage(string $prompt, string $size = '1024x1024'): array
    {
        $prompt = trim($prompt);
        if ($prompt === '') {
            return ['success' => false, 'error' => 'Image prompt cannot be empty.'];
        }

        $dir = dirname(__DIR__, 2) . '/public/uploads/ai_images';
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $openaiRow = Database::fetch("SELECT `value` FROM `system_settings` WHERE `key` = 'ai_provider_chatgpt'");
        $openaiCfg = $openaiRow ? (json_decode($openaiRow['value'], true) ?: []) : [];
        $openaiKey = trim((string)($openaiCfg['api_key'] ?? ''));

        $geminiRow = Database::fetch("SELECT `value` FROM `system_settings` WHERE `key` = 'ai_provider_gemini'");
        $geminiCfg = $geminiRow ? (json_decode($geminiRow['value'], true) ?: []) : [];
        $geminiKey = trim((string)($geminiCfg['api_key'] ?? ''));

        $filename = 'ai_img_' . date('Ymd_His') . '_' . substr(bin2hex(random_bytes(3)), 0, 6) . '.png';
        $filePath = $dir . '/' . $filename;

        // 1. Try OpenAI DALL-E 3 if OpenAI API key is configured
        if ($openaiKey !== '') {
            $allowedSizes = ['1024x1024', '1024x1792', '1792x1024'];
            $imgSize = in_array($size, $allowedSizes, true) ? $size : '1024x1024';

            $res = $this->httpPostJson(
                'https://api.openai.com/v1/images/generations',
                [
                    'model' => 'dall-e-3',
                    'prompt' => $prompt,
                    'n' => 1,
                    'size' => $imgSize,
                    'response_format' => 'b64_json'
                ],
                ['Authorization: Bearer ' . $openaiKey],
                60
            );

            if ($res['code'] === 200 && !empty($res['data']['data'][0]['b64_json'])) {
                file_put_contents($filePath, base64_decode($res['data']['data'][0]['b64_json']));
                $url = '/uploads/ai_images/' . $filename;
                return [
                    'success' => true,
                    'provider' => 'dall-e-3',
                    'image_url' => $url,
                    'markdown_image' => "![{$prompt}]({$url})"
                ];
            }
        }

        // 2. Try Google Imagen 3 / Gemini Image Generation if Gemini API key is configured
        if ($geminiKey !== '') {
            $res = $this->httpPostJson(
                "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=" . urlencode($geminiKey),
                [
                    'instances' => [['prompt' => $prompt]],
                    'parameters' => ['sampleCount' => 1]
                ],
                [],
                60
            );

            $b64 = $res['data']['predictions'][0]['bytesBase64Encoded'] ?? '';
            if ($res['code'] === 200 && $b64 !== '') {
                file_put_contents($filePath, base64_decode($b64));
                $url = '/uploads/ai_images/' . $filename;
                return [
                    'success' => true,
                    'provider' => 'google-imagen-3',
                    'image_url' => $url,
                    'markdown_image' => "![{$prompt}]({$url})"
                ];
            }

            // Fallback attempt: Gemini 2.0 flash image generation
            $res2 = $this->httpPostJson(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=" . urlencode($geminiKey),
                [
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => ['responseModalities' => ['TEXT', 'IMAGE']]
                ],
                [],
                60
            );
            $parts = $res2['data']['candidates'][0]['content']['parts'] ?? [];
            foreach ($parts as $pt) {
                if (!empty($pt['inlineData']['data'])) {
                    file_put_contents($filePath, base64_decode($pt['inlineData']['data']));
                    $url = '/uploads/ai_images/' . $filename;
                    return [
                        'success' => true,
                        'provider' => 'gemini-image',
                        'image_url' => $url,
                        'markdown_image' => "![{$prompt}]({$url})"
                    ];
                }
            }
        }

        return [
            'success' => false,
            'error' => 'Image generation requires an active OpenAI (DALL-E 3) API key or a Google Gemini key with Imagen enabled in AI Model Settings.'
        ];
    }

    public function toolCreateProject(array $args, array $guardrails): array
    {
        if (empty($guardrails['add'])) {
            return ['success' => false, 'error' => 'Creating records is disabled in AI Security Guardrails.'];
        }
        $title = trim((string)($args['title'] ?? ''));
        if ($title === '') {
            return ['success' => false, 'error' => 'Project title is required.'];
        }

        $status = trim((string)($args['status'] ?? 'Pending')) ?: 'Pending';
        $due = trim((string)($args['due_date'] ?? '')) ?: date('Y-m-d', strtotime('+30 days'));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $due)) {
            $ts = strtotime($due);
            $due = $ts ? date('Y-m-d', $ts) : date('Y-m-d', strtotime('+30 days'));
        }

        $newId = Database::insert('projects', [
            'project_title' => $title,
            'project_address' => trim((string)($args['address'] ?? '')),
            'project_construction_type' => trim((string)($args['construction_type'] ?? 'Commercial')),
            'project_main_scope' => trim((string)($args['main_scope'] ?? '')),
            'project_progress_status' => $status,
            'project_preview_status' => 'active',
            'project_total_budget' => trim((string)($args['budget'] ?? '')),
            'project_points' => isset($args['points']) ? (float)$args['points'] : 0,
            'project_due_date' => $due,
            'project_admin_notes' => trim((string)($args['admin_notes'] ?? 'Created via AI Assistant')),
            'is_project_late' => 0,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return [
            'success' => true,
            'project_id' => $newId,
            'title' => $title,
            'status' => $status,
            'due_date' => $due,
            'view_link' => "/projects/view/{$newId}",
            'edit_link' => "/projects/edit/{$newId}"
        ];
    }

    public function toolUpdateProject(array $args, array $guardrails, int $contextProjectId = 0): array
    {
        if (empty($guardrails['edit'])) {
            return ['success' => false, 'error' => 'Editing records is disabled in AI Security Guardrails.'];
        }

        $targetQuery = trim((string)($args['project_id_or_title'] ?? ''));
        $pid = 0;
        if ($targetQuery !== '' && is_numeric($targetQuery)) {
            $pid = (int)$targetQuery;
        } elseif (preg_match('/#(\d+)/', $targetQuery, $m)) {
            $pid = (int)$m[1];
        } elseif ($targetQuery !== '') {
            $found = $this->fuzzySearchErp($targetQuery, 'projects', '', 1);
            if (!empty($found['projects'])) {
                $pid = (int)$found['projects'][0]['id'];
            }
        } elseif ($contextProjectId > 0) {
            $pid = $contextProjectId;
        }

        if ($pid <= 0) {
            return ['success' => false, 'error' => 'Could not determine which project to update. Please specify a project ID or title.'];
        }

        $existing = Database::fetch("SELECT id, project_title FROM projects WHERE id = :id AND deleted_at IS NULL", ['id' => $pid]);
        if (!$existing) {
            return ['success' => false, 'error' => "Project #{$pid} not found."];
        }

        $fields = is_array($args['fields'] ?? null) ? $args['fields'] : $args;
        $allowed = [
            'project_title', 'project_address', 'project_progress_status', 'project_due_date',
            'project_construction_type', 'project_main_scope', 'project_scope_details',
            'project_admin_notes', 'project_estimator_notes', 'project_total_budget', 'project_points'
        ];
        // Also support shorthand field names from LLMs
        $aliases = [
            'title' => 'project_title',
            'status' => 'project_progress_status',
            'due_date' => 'project_due_date',
            'address' => 'project_address',
            'notes' => 'project_admin_notes',
            'admin_notes' => 'project_admin_notes',
            'estimator_notes' => 'project_estimator_notes',
            'budget' => 'project_total_budget',
            'points' => 'project_points',
            'main_scope' => 'project_main_scope',
        ];

        $updates = [];
        foreach ($fields as $k => $v) {
            $mapped = $aliases[$k] ?? $k;
            if (in_array($mapped, $allowed, true) && $v !== null && $v !== '') {
                $updates[$mapped] = $v;
            }
        }

        if (empty($updates)) {
            return ['success' => false, 'error' => 'No valid updatable fields supplied.'];
        }

        $updates['updated_at'] = date('Y-m-d H:i:s');
        Database::update('projects', $updates, 'id = :id', ['id' => $pid]);

        return [
            'success' => true,
            'project_id' => $pid,
            'project_title' => $updates['project_title'] ?? $existing['project_title'],
            'updated_fields' => $updates,
            'view_link' => "/projects/view/{$pid}"
        ];
    }

    // =========================================================================
    // TABULAR DATA + OOXML (.XLSX) + PURE-PHP PDF BUILDERS
    // =========================================================================

    private function gatherTabularReportData(string $module, string $statusFilter, string $keyword, string $projectIdOrTitle): array
    {
        $module = strtolower(trim($module));
        if ($module === 'project_detail' || $projectIdOrTitle !== '') {
            $detail = $this->toolGetProjectFullDetails($projectIdOrTitle ?: $keyword);
            if (!empty($detail['found'])) {
                $p = $detail['project'];
                $headers = ['Section', 'Field', 'Value'];
                $rows = [
                    ['Overview', 'Project ID', '#' . $p['id']],
                    ['Overview', 'Title', (string)($p['project_title'] ?? '')],
                    ['Overview', 'Status', (string)($p['project_progress_status'] ?? 'Pending')],
                    ['Overview', 'Due Date', (string)($p['project_due_date'] ?? 'N/A')],
                    ['Overview', 'Address', (string)($p['project_address'] ?? 'N/A')],
                    ['Overview', 'Construction Type', (string)($p['project_construction_type'] ?? 'N/A')],
                    ['Overview', 'Budget', (string)($p['project_total_budget'] ?? 'N/A')],
                    ['Overview', 'Points', (string)($p['project_points'] ?? '0')],
                    ['Scope', 'Main Scope', (string)($p['project_main_scope'] ?? '')],
                    ['Scope', 'Scope Details', (string)($p['project_scope_details_text'] ?? '')],
                    ['Notes', 'Estimator Notes', (string)($p['project_estimator_notes_text'] ?? '')],
                    ['Notes', 'Admin Notes', (string)($p['project_admin_notes_text'] ?? '')],
                ];
                foreach ($detail['clients'] as $c) {
                    $rows[] = ['Client', (string)($c['name'] ?: $c['title']), trim(($c['email'] ?? '') . ' | ' . ($c['phone'] ?? ''))];
                }
                foreach ($detail['team_members'] as $tm) {
                    $rows[] = ['Team', (string)($tm['full_name'] ?: $tm['username']), "Steps: {$tm['steps']} | Points: {$tm['points_gain']} | Status: {$tm['member_status']}"];
                }
                return [$headers, $rows, "Project Dossier: #{$p['id']} {$p['project_title']}"];
            }
        }

        if ($module === 'clients') {
            $search = $this->fuzzySearchErp($keyword, 'clients', $statusFilter, 50);
            $headers = ['ID', 'Client Name', 'Type', 'Email', 'Phone', 'Location'];
            $rows = [];
            foreach ($search['clients'] as $c) {
                $loc = trim(implode(', ', array_filter([$c['city'] ?? '', $c['state'] ?? '', $c['country'] ?? ''])));
                $rows[] = [
                    $c['id'],
                    (string)($c['name'] ?: $c['title'] ?: ''),
                    (string)($c['client_type'] ?? ''),
                    (string)($c['email'] ?? ''),
                    (string)($c['phone'] ?? ''),
                    $loc
                ];
            }
            return [$headers, $rows, 'Clients Directory (' . count($rows) . ' records)'];
        }

        if ($module === 'users') {
            $search = $this->fuzzySearchErp($keyword, 'users', $statusFilter, 50);
            $headers = ['ID', 'Name', 'Username', 'Role', 'Email', 'Status', 'Last Active'];
            $rows = [];
            foreach ($search['users'] as $u) {
                $rows[] = [
                    $u['id'],
                    (string)($u['full_name'] ?: $u['username']),
                    (string)$u['username'],
                    (string)($u['role_name'] ?? 'Staff'),
                    (string)($u['email'] ?? ''),
                    (string)($u['status'] ?? ''),
                    (string)($u['last_active_at'] ?? '')
                ];
            }
            return [$headers, $rows, 'Staff & Users Directory (' . count($rows) . ' records)'];
        }

        if ($module === 'activity') {
            $rep = $this->toolGetTeamActivityReport($keyword, date('Y-m-d', strtotime('-7 days')), date('Y-m-d'));
            $headers = ['User ID', 'Name', 'Total Logs', 'Active Logs', 'Idle Logs', 'Clicks', 'Keystrokes'];
            $rows = [];
            foreach ($rep['activity_summary'] as $a) {
                $rows[] = [
                    $a['user_id'],
                    (string)$a['full_name'],
                    (int)$a['total_logs'],
                    (int)$a['active_logs'],
                    (int)$a['idle_logs'],
                    (int)$a['total_clicks'],
                    (int)$a['total_keystrokes'],
                ];
            }
            return [$headers, $rows, "Activity Report ({$rep['date_from']} to {$rep['date_to']})"];
        }

        // Default: projects
        $search = $this->fuzzySearchErp($keyword, 'projects', $statusFilter, 50);
        $headers = ['ID', 'Project Title', 'Client', 'Status', 'Due Date', 'Points', 'Budget', 'Late'];
        $rows = [];
        foreach ($search['projects'] as $p) {
            $rows[] = [
                $p['id'],
                (string)$p['project_title'],
                (string)($p['primary_client_name'] ?? '—'),
                (string)($p['project_progress_status'] ?? 'Pending'),
                (string)($p['project_due_date'] ?? '—'),
                (string)($p['project_points'] ?? '0'),
                (string)($p['project_total_budget'] ?? '—'),
                ((int)($p['is_project_late'] ?? 0) === 1 ? 'YES' : 'No')
            ];
        }
        $sub = 'Projects Report (' . count($rows) . ' records)';
        if ($statusFilter !== '') $sub .= " | Filter: {$statusFilter}";
        return [$headers, $rows, $sub];
    }

    private function buildXlsxFile(string $filePath, string $sheetTitle, array $headers, array $rows): bool
    {
        if (!class_exists('ZipArchive')) {
            return false;
        }

        $zip = new ZipArchive();
        if ($zip->open($filePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return false;
        }

        $safeSheetName = preg_replace('/[\\\\\\/\\?\\*\\[\\]:]/', '', mb_substr($sheetTitle, 0, 30)) ?: 'Report';

        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>');

        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>');

        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>');

        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="' . htmlspecialchars($safeSheetName, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>');

        // Style 0: default, Style 1: Header (bold white on indigo), Style 2: Title
        $zip->addFromString('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="13"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
  </cellXfs>
</styleSheet>');

        $colName = function (int $idx): string {
            $name = '';
            while ($idx >= 0) {
                $name = chr(65 + ($idx % 26)) . $name;
                $idx = intdiv($idx, 26) - 1;
            }
            return $name;
        };

        $xmlCell = function (string $ref, mixed $val, int $style = 3): string {
            $str = (string)$val;
            $str = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', ' ', $str);
            if (is_numeric($val) && !str_starts_with($str, '0') && strlen($str) < 12) {
                return "<c r=\"{$ref}\" s=\"{$style}\"><v>{$val}</v></c>";
            }
            $escaped = htmlspecialchars($str, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            return "<c r=\"{$ref}\" t=\"inlineStr\" s=\"{$style}\"><is><t>{$escaped}</t></is></c>";
        };

        $sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
        $sheetXml .= '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>';
        for ($i = 1; $i <= max(1, count($headers)); $i++) {
            $w = $i === 2 ? 34 : 18;
            $sheetXml .= "<col min=\"{$i}\" max=\"{$i}\" width=\"{$w}\" customWidth=\"1\"/>";
        }
        $sheetXml .= '</cols><sheetData>';

        // Row 1: Report Title & Timestamp
        $sheetXml .= '<row r="1">' . $xmlCell('A1', $sheetTitle . ' — Generated ' . date('Y-m-d H:i'), 2) . '</row>';

        // Row 3: Column Headers
        $sheetXml .= '<row r="3">';
        foreach ($headers as $cIdx => $h) {
            $sheetXml .= $xmlCell($colName($cIdx) . '3', $h, 1);
        }
        $sheetXml .= '</row>';

        // Data Rows starting Row 4
        $rNum = 4;
        foreach ($rows as $row) {
            $sheetXml .= "<row r=\"{$rNum}\">";
            foreach ($headers as $cIdx => $_) {
                $sheetXml .= $xmlCell($colName($cIdx) . $rNum, $row[$cIdx] ?? '', 3);
            }
            $sheetXml .= '</row>';
            $rNum++;
        }

        $sheetXml .= '</sheetData></worksheet>';
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
        $zip->close();
        return true;
    }

    /**
     * Pure-PHP PDF 1.4 multi-page generator (Helvetica + branded header bar + bordered table).
     */
    private function buildPurePhpPdf(
        string $filePath,
        string $title,
        string $subtitle,
        string $summaryNote,
        array $headers,
        array $rows
    ): void {
        $pageW = 612; // Letter Portrait
        $pageH = 792;
        $margin = 36;
        $usableW = $pageW - ($margin * 2); // 540 pt

        $esc = fn(string $s): string => str_replace(
            ['\\', '(', ')'],
            ['\\\\', '\\(', '\\)'],
            mb_convert_encoding(preg_replace('/[^\x20-\x7E]/', ' ', $s), 'ISO-8859-1', 'UTF-8')
        );

        $colCount = max(1, count($headers));
        $colW = $usableW / $colCount;
        $maxCharsPerCell = max(8, (int)floor(($colW - 8) / 4.8));

        $pagesContent = [];
        $currentStream = '';
        $y = $pageH - 40;

        $startPage = function (bool $isFirst) use (&$currentStream, &$y, $pageW, $pageH, $margin, $usableW, $title, $subtitle, $summaryNote, $esc) {
            $currentStream = '';
            // Branded Header Banner
            $currentStream .= "0.31 0.27 0.90 rg\n0 " . ($pageH - 68) . " {$pageW} 68 re f\n";
            $currentStream .= "1 1 1 rg\nBT /F2 15 Tf {$margin} " . ($pageH - 34) . " Td (" . $esc($title) . ") Tj ET\n";
            $currentStream .= "0.88 0.90 1.0 rg\nBT /F1 9 Tf {$margin} " . ($pageH - 52) . " Td (" . $esc($subtitle . '  |  Generated: ' . date('Y-m-d H:i')) . ") Tj ET\n";
            $y = $pageH - 92;

            if ($isFirst && trim($summaryNote) !== '') {
                $lines = explode("\n", wordwrap($summaryNote, 92, "\n", true));
                $boxH = (count($lines) * 12) + 14;
                $currentStream .= "0.97 0.98 1.0 rg\n{$margin} " . ($y - $boxH + 10) . " {$usableW} {$boxH} re f\n";
                $currentStream .= "0.12 0.16 0.23 rg\n";
                $ty = $y - 4;
                foreach ($lines as $ln) {
                    $currentStream .= "BT /F1 9 Tf " . ($margin + 8) . " {$ty} Td (" . $esc($ln) . ") Tj ET\n";
                    $ty -= 12;
                }
                $y -= ($boxH + 10);
            }
        };

        $drawTableHeader = function () use (&$currentStream, &$y, $margin, $usableW, $headers, $colW, $maxCharsPerCell, $esc) {
            $rowH = 20;
            $currentStream .= "0.12 0.16 0.23 rg\n{$margin} " . ($y - $rowH) . " {$usableW} {$rowH} re f\n";
            $currentStream .= "1 1 1 rg\n";
            foreach ($headers as $idx => $h) {
                $x = $margin + ($idx * $colW) + 4;
                $label = mb_substr((string)$h, 0, $maxCharsPerCell);
                $currentStream .= "BT /F2 8 Tf {$x} " . ($y - 13) . " Td (" . $esc($label) . ") Tj ET\n";
            }
            $y -= $rowH;
        };

        $startPage(true);
        $drawTableHeader();

        foreach ($rows as $rIdx => $row) {
            if ($y < 60) {
                // Footer page number
                $pageNum = count($pagesContent) + 1;
                $currentStream .= "0.45 0.50 0.58 rg\nBT /F1 8 Tf {$margin} 22 Td (ERP AI Executive Report - Page {$pageNum}) Tj ET\n";
                $pagesContent[] = $currentStream;
                $startPage(false);
                $drawTableHeader();
            }

            $rowH = 18;
            if ($rIdx % 2 === 1) {
                $currentStream .= "0.96 0.97 0.99 rg\n{$margin} " . ($y - $rowH) . " {$usableW} {$rowH} re f\n";
            }
            // Bottom border line
            $currentStream .= "0.88 0.90 0.94 RG\n0.5 w\n{$margin} " . ($y - $rowH) . " m " . ($margin + $usableW) . " " . ($y - $rowH) . " l S\n";
            $currentStream .= "0.15 0.20 0.28 rg\n";

            foreach ($headers as $cIdx => $_) {
                $val = self::cleanPlainText((string)($row[$cIdx] ?? ''), $maxCharsPerCell);
                if (mb_strlen($val) > $maxCharsPerCell) {
                    $val = mb_substr($val, 0, max(1, $maxCharsPerCell - 2)) . '..';
                }
                $x = $margin + ($cIdx * $colW) + 4;
                $currentStream .= "BT /F1 8 Tf {$x} " . ($y - 12) . " Td (" . $esc($val) . ") Tj ET\n";
            }
            $y -= $rowH;
        }

        if (empty($rows)) {
            $currentStream .= "0.40 0.45 0.55 rg\nBT /F1 10 Tf {$margin} " . ($y - 24) . " Td (No matching records found for the requested filters.) Tj ET\n";
        }

        $pageNum = count($pagesContent) + 1;
        $currentStream .= "0.45 0.50 0.58 rg\nBT /F1 8 Tf {$margin} 22 Td (ERP AI Executive Report - Page {$pageNum}) Tj ET\n";
        $pagesContent[] = $currentStream;

        // Assemble PDF Objects
        $objects = [];
        $objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
        $pageObjectIds = [];
        $nextId = 3;

        $font1Id = $nextId++;
        $font2Id = $nextId++;
        $objects[$font1Id] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
        $objects[$font2Id] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

        foreach ($pagesContent as $stream) {
            $contentId = $nextId++;
            $pageId = $nextId++;
            $len = strlen($stream);
            $objects[$contentId] = "<< /Length {$len} >>\nstream\n{$stream}\nendstream";
            $objects[$pageId] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {$pageW} {$pageH}] /Resources << /Font << /F1 {$font1Id} 0 R /F2 {$font2Id} 0 R >> >> /Contents {$contentId} 0 R >>";
            $pageObjectIds[] = $pageId;
        }

        $kidsStr = implode(' ', array_map(fn($id) => "{$id} 0 R", $pageObjectIds));
        $objects[2] = "<< /Type /Pages /Kids [{$kidsStr}] /Count " . count($pageObjectIds) . " >>";
        ksort($objects);

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $id => $body) {
            $offsets[$id] = strlen($pdf);
            $pdf .= "{$id} 0 obj\n{$body}\nendobj\n";
        }

        $xrefPos = strlen($pdf);
        $totalObjs = count($objects) + 1;
        $pdf .= "xref\n0 {$totalObjs}\n0000000000 65535 f \n";
        for ($i = 1; $i < $totalObjs; $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }
        $pdf .= "trailer\n<< /Size {$totalObjs} /Root 1 0 R >>\nstartxref\n{$xrefPos}\n%%EOF";

        file_put_contents($filePath, $pdf);
    }

    // =========================================================================
    // TOOL DEFINITIONS & DISPATCHER
    // =========================================================================

    private function getToolDefinitions(array $guardrails): array
    {
        $tools = [];
        if (!empty($guardrails['read'])) {
            $tools[] = [
                'name' => 'search_erp_records',
                'description' => 'Fuzzy, typo-tolerant and case-insensitive search across ERP projects, clients, staff users, and takeoff sessions. Use this whenever looking up any entity, listing records by status, or finding partial/misspelled names.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'query' => ['type' => 'string', 'description' => 'Search keyword(s), project/client/user name, ID, or empty string to list recent records.'],
                        'module' => ['type' => 'string', 'enum' => ['all', 'projects', 'clients', 'users', 'takeoff'], 'description' => 'Module to search.'],
                        'status_filter' => ['type' => 'string', 'description' => 'Optional status filter e.g. Pending, Completed, In Progress, Hold, Cancelled, late.'],
                        'limit' => ['type' => 'integer', 'description' => 'Max results per module (default 15, max 50).']
                    ],
                    'required' => ['query']
                ]
            ];
            $tools[] = [
                'name' => 'get_project_full_details',
                'description' => 'Retrieve complete project dossier including clean scope details, estimator notes, admin notes, linked clients, assigned team members with points, and takeoff sessions.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'project_id_or_title' => ['type' => 'string', 'description' => 'Project ID or title (typo tolerant).']
                    ],
                    'required' => ['project_id_or_title']
                ]
            ];
            $tools[] = [
                'name' => 'get_team_activity_report',
                'description' => 'Retrieve live desktop tracker metrics (active vs idle logs, clicks, keystrokes, top apps/window titles) for one user or the team over a date range.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'user_query' => ['type' => 'string', 'description' => 'Staff username or full name (leave empty for whole team).'],
                        'date_from' => ['type' => 'string', 'description' => 'YYYY-MM-DD start date (default yesterday).'],
                        'date_to' => ['type' => 'string', 'description' => 'YYYY-MM-DD end date (default today).']
                    ]
                ]
            ];
            $tools[] = [
                'name' => 'run_safe_sql_select',
                'description' => 'Execute a strictly read-only SQL SELECT query for aggregations, counts, revenue/points totals, or custom filtering when search tools need exact math. Max 50 rows.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'sql' => ['type' => 'string', 'description' => 'A single read-only MySQL SELECT query (no password_hash or api_key columns).']
                    ],
                    'required' => ['sql']
                ]
            ];
            $tools[] = [
                'name' => 'generate_pdf_report',
                'description' => 'Generate a downloadable branded PDF report from live ERP data and return a download link.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'title' => ['type' => 'string', 'description' => 'Report title e.g. Pending Projects Executive Summary'],
                        'module' => ['type' => 'string', 'enum' => ['projects', 'clients', 'users', 'activity', 'project_detail']],
                        'project_id_or_title' => ['type' => 'string', 'description' => 'Required if module is project_detail.'],
                        'status_filter' => ['type' => 'string', 'description' => 'Optional status filter.'],
                        'keyword' => ['type' => 'string', 'description' => 'Optional search filter.'],
                        'summary_note' => ['type' => 'string', 'description' => 'Executive intro paragraph shown inside the PDF.']
                    ],
                    'required' => ['title', 'module']
                ]
            ];
            $tools[] = [
                'name' => 'export_excel_report',
                'description' => 'Create a real downloadable .xlsx Excel spreadsheet of ERP data (projects, clients, users, or activity) and return a download link.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'title' => ['type' => 'string', 'description' => 'Spreadsheet title.'],
                        'module' => ['type' => 'string', 'enum' => ['projects', 'clients', 'users', 'activity']],
                        'status_filter' => ['type' => 'string', 'description' => 'Optional status filter e.g. Pending.'],
                        'keyword' => ['type' => 'string', 'description' => 'Optional keyword filter.']
                    ],
                    'required' => ['title', 'module']
                ]
            ];
        }

        $tools[] = [
            'name' => 'generate_image',
            'description' => 'Generate a realistic image, architectural visual, or concept rendering via AI image API and embed it in chat.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'prompt' => ['type' => 'string', 'description' => 'Detailed visual prompt for image generation.'],
                    'size' => ['type' => 'string', 'enum' => ['1024x1024', '1024x1792', '1792x1024']]
                ],
                'required' => ['prompt']
            ]
        ];

        if (!empty($guardrails['add'])) {
            $tools[] = [
                'name' => 'create_project',
                'description' => 'Create a new project record in the ERP database.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'title' => ['type' => 'string'],
                        'status' => ['type' => 'string'],
                        'due_date' => ['type' => 'string', 'description' => 'YYYY-MM-DD'],
                        'address' => ['type' => 'string'],
                        'construction_type' => ['type' => 'string'],
                        'main_scope' => ['type' => 'string'],
                        'budget' => ['type' => 'string'],
                        'points' => ['type' => 'number'],
                        'admin_notes' => ['type' => 'string']
                    ],
                    'required' => ['title']
                ]
            ];
        }

        if (!empty($guardrails['edit'])) {
            $tools[] = [
                'name' => 'update_project',
                'description' => 'Update an existing project status, due date, notes, title, or budget in the ERP database.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'project_id_or_title' => ['type' => 'string'],
                        'fields' => [
                            'type' => 'object',
                            'description' => 'Object of fields to update: project_progress_status, project_due_date, project_title, project_admin_notes, project_estimator_notes, project_total_budget, project_points.'
                        ]
                    ],
                    'required' => ['project_id_or_title', 'fields']
                ]
            ];
        }

        return $tools;
    }

    private function dispatchToolCall(string $name, array $args, array $guardrails, int $contextProjectId): array
    {
        return match ($name) {
            'search_erp_records' => empty($guardrails['read'])
                ? ['error' => 'Read access disabled']
                : $this->fuzzySearchErp(
                    (string)($args['query'] ?? ''),
                    (string)($args['module'] ?? 'all'),
                    (string)($args['status_filter'] ?? ''),
                    (int)($args['limit'] ?? 15)
                ),
            'get_project_full_details' => empty($guardrails['read'])
                ? ['error' => 'Read access disabled']
                : $this->toolGetProjectFullDetails((string)($args['project_id_or_title'] ?? '')),
            'get_team_activity_report' => empty($guardrails['read'])
                ? ['error' => 'Read access disabled']
                : $this->toolGetTeamActivityReport(
                    (string)($args['user_query'] ?? ''),
                    (string)($args['date_from'] ?? ''),
                    (string)($args['date_to'] ?? '')
                ),
            'run_safe_sql_select' => empty($guardrails['read'])
                ? ['error' => 'Read access disabled']
                : $this->toolRunSafeSqlSelect((string)($args['sql'] ?? '')),
            'generate_pdf_report' => empty($guardrails['read'])
                ? ['error' => 'Read access disabled']
                : $this->toolGeneratePdfReport(
                    (string)($args['title'] ?? 'ERP Report'),
                    (string)($args['module'] ?? 'projects'),
                    (string)($args['project_id_or_title'] ?? ''),
                    (string)($args['status_filter'] ?? ''),
                    (string)($args['keyword'] ?? ''),
                    (string)($args['summary_note'] ?? '')
                ),
            'export_excel_report' => empty($guardrails['read'])
                ? ['error' => 'Read access disabled']
                : $this->toolExportExcelReport(
                    (string)($args['title'] ?? 'ERP Export'),
                    (string)($args['module'] ?? 'projects'),
                    (string)($args['status_filter'] ?? ''),
                    (string)($args['keyword'] ?? '')
                ),
            'generate_image' => $this->toolGenerateImage(
                (string)($args['prompt'] ?? ''),
                (string)($args['size'] ?? '1024x1024')
            ),
            'create_project' => $this->toolCreateProject($args, $guardrails),
            'update_project' => $this->toolUpdateProject($args, $guardrails, $contextProjectId),
            default => ['error' => "Unknown tool: {$name}"]
        };
    }

    // =========================================================================
    // ATTACHMENTS PROCESSING
    // =========================================================================

    private function processUploadedAttachments(array $attachments): array
    {
        if (empty($attachments)) return [];
        $dir = dirname(__DIR__, 2) . '/public/uploads/ai_attachments';
        if (!is_dir($dir)) mkdir($dir, 0777, true);

        $processed = [];
        foreach ($attachments as $att) {
            if (empty($att['tmp_name']) || !file_exists($att['tmp_name'])) continue;
            $origName = basename((string)($att['name'] ?? 'file'));
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $mime = (string)($att['type'] ?? @mime_content_type($att['tmp_name']) ?: 'application/octet-stream');
            $raw = file_get_contents($att['tmp_name']);
            if ($raw === false || strlen($raw) === 0) continue;

            $savedName = date('Ymd_His') . '_' . substr(bin2hex(random_bytes(3)), 0, 6) . '_' . preg_replace('/[^a-z0-9._-]/i', '_', $origName);
            @file_put_contents($dir . '/' . $savedName, $raw);

            $isImage = str_starts_with($mime, 'image/') || in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'gif'], true);
            $isPdf = ($mime === 'application/pdf' || $ext === 'pdf');
            $isText = str_starts_with($mime, 'text/') || in_array($ext, ['txt', 'csv', 'json', 'md', 'xml', 'log', 'tsv'], true);

            $extractedText = '';
            if ($isText) {
                $extractedText = mb_substr($raw, 0, 60000);
            } elseif ($isPdf) {
                $extractedText = $this->extractReadableTextFromPdf($raw);
            }

            $processed[] = [
                'name' => $origName,
                'mime' => $mime,
                'ext' => $ext,
                'url' => '/uploads/ai_attachments/' . $savedName,
                'is_image' => $isImage,
                'is_pdf' => $isPdf,
                'is_text' => $isText,
                'base64' => ($isImage || ($isPdf && strlen($raw) < 12 * 1024 * 1024)) ? base64_encode($raw) : '',
                'extracted_text' => $extractedText
            ];
        }
        return $processed;
    }

    private function extractReadableTextFromPdf(string $binary): string
    {
        $text = '';
        // Decompress FlateDecode streams when zlib is available
        if (function_exists('gzuncompress') && preg_match_all('/stream[\r\n]+(.*?)endstream/s', $binary, $streams)) {
            foreach ($streams[1] as $st) {
                $decoded = @gzuncompress(trim($st)) ?: $st;
                if (preg_match_all('/\(([^()]{2,})\)/', $decoded, $txts)) {
                    $text .= ' ' . implode(' ', $txts[1]);
                }
            }
        }
        if (trim($text) === '' && preg_match_all('/[A-Za-z0-9 ,.:;\/\-_$%#]{6,}/', $binary, $ascii)) {
            $text = implode(' ', array_slice($ascii[0], 0, 400));
        }
        return trim(preg_replace('/\s+/', ' ', mb_substr($text, 0, 35000)));
    }

    private function buildAttachmentTextBlock(array $attachments): string
    {
        if (empty($attachments)) return '';
        $lines = ["--- ATTACHED FILES FROM USER ---"];
        foreach ($attachments as $att) {
            $lines[] = "File: {$att['name']} ({$att['mime']}) [Uploaded: {$att['url']}]";
            if ($att['extracted_text'] !== '') {
                $lines[] = "Extracted Content:\n" . $att['extracted_text'];
            } elseif ($att['is_image']) {
                $lines[] = "(Image file attached for visual analysis.)";
            } elseif ($att['is_pdf']) {
                $lines[] = "(Binary/scanned PDF attached. If the active model supports native PDF vision like Gemini or Claude, inspect the attached PDF bytes directly.)";
            }
        }
        return implode("\n", $lines);
    }

    // =========================================================================
    // SYSTEM PROMPT & PRE-CONTEXT BUILDER
    // =========================================================================

    private function buildSystemPrompt(int $projectId, array $guardrails): string
    {
        $today = date('Y-m-d H:i:s');
        $readStatus = !empty($guardrails['read']) ? 'ENABLED' : 'DISABLED';
        $addStatus = !empty($guardrails['add']) ? 'ENABLED' : 'DISABLED';
        $editStatus = !empty($guardrails['edit']) ? 'ENABLED' : 'DISABLED';

        $prompt = "You are the IMP Estimation ERP Senior AI Assistant & Analyst. Today is {$today}.\n"
            . "Permissions -> READ: {$readStatus} | CREATE: {$addStatus} | EDIT: {$editStatus} | DELETE: PERMANENTLY BLOCKED.\n\n"
            . "DATABASE SCHEMA OVERVIEW (use `search_erp_records`, `get_project_full_details`, `get_team_activity_report`, or `run_safe_sql_select`):\n"
            . "- `projects` (id, project_title, project_address, client_id, project_pricing, project_area, project_construction_type, project_main_scope, project_scope_details, project_admin_notes, project_estimator_notes, project_total_budget, project_due_date, project_points, project_progress_status, is_project_late, project_init_link, project_final_link, deleted_at)\n"
            . "- `clients` (id, title, name, email, phone, address, city, state, country, client_type, notes, deleted_at)\n"
            . "- `users` (id, username, email, role_id, wfh_allowed, status, last_active_at, deleted_at) + `user_profiles` (user_id, full_name, phone) + `roles` (id, name)\n"
            . "- `project_clients` (project_id, client_id) & `project_team_members` (project_id, user_id, steps, status, points_gain, notes)\n"
            . "- `takeoff_sessions` (id, project_id, name, description, status) & `takeoff_measurements` (id, session_id, type, computed_quantity, unit, label)\n"
            . "- `user_activities` (id, user_id, app_name, window_title, url, clicks, keystrokes, is_idle, tracked_at)\n\n"
            . "BEHAVIORAL RULES:\n"
            . "1. NEVER claim data does not exist without calling `search_erp_records` or `run_safe_sql_select` first — users often type partial names, typos, or wrong casing.\n"
            . "2. When a tool returns a `markdown_link` (PDF or Excel file) or `markdown_image` (generated image), ALWAYS include that EXACT markdown link `[Download ...](/uploads/...)` or `![...](/uploads/...)` verbatim in your final reply so the user gets a one-click download button or inline image.\n"
            . "3. Present findings cleanly with Markdown headings, concise tables, and clickable ERP links like `[#12 - Title](/projects/view/12)`.\n"
            . "4. NEVER invent database rows, IDs, or download URLs.\n";

        if ($projectId > 0) {
            $prompt .= "\nACTIVE PROJECT CONTEXT: The user has opened the assistant inside Project #{$projectId}. Prioritize this project unless asked about others.\n";
        }

        return $prompt;
    }

    private function buildPreFetchedContext(string $message, int $projectId, array $guardrails): string
    {
        if (empty($guardrails['read'])) {
            return "[Read access is disabled by security policy.]";
        }

        $parts = [];
        $stats = Database::fetch("
            SELECT
                (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL) AS total_projects,
                (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND project_progress_status = 'Pending') AS pending_projects,
                (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND project_progress_status = 'Completed') AS completed_projects,
                (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND is_project_late = 1) AS late_projects,
                (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL) AS total_clients,
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users
        ");
        if ($stats) {
            $parts[] = "ERP LIVE TOTALS: Projects={$stats['total_projects']} (Pending={$stats['pending_projects']}, Completed={$stats['completed_projects']}, Late={$stats['late_projects']}) | Clients={$stats['total_clients']} | Users={$stats['total_users']}";
        }

        if ($projectId > 0) {
            $detail = $this->toolGetProjectFullDetails((string)$projectId);
            if (!empty($detail['found'])) {
                $parts[] = "FOCUSED PROJECT DOSSIER:\n" . json_encode($detail, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        }

        $fuzzy = $this->fuzzySearchErp($message, 'all', '', 6);
        $hasMatches = !empty($fuzzy['projects']) || !empty($fuzzy['clients']) || !empty($fuzzy['users']);
        if ($hasMatches) {
            $compact = [
                'projects' => array_slice($fuzzy['projects'], 0, 5),
                'clients' => array_slice($fuzzy['clients'], 0, 5),
                'users' => array_slice($fuzzy['users'], 0, 5),
            ];
            $parts[] = "TOP FUZZY MATCHES FOR QUERY:\n" . json_encode($compact, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        return implode("\n\n", $parts);
    }

    // =========================================================================
    // MULTI-PROVIDER TOOL-CALLING LOOP (OPENAI/GROQ/DEEPSEEK, GEMINI, CLAUDE)
    // =========================================================================

    private function executeProviderLoop(
        string $provider,
        string $apiKey,
        string $model,
        float $temperature,
        string $systemPrompt,
        string $fuzzyContext,
        array $historyRows,
        string $userMessage,
        array $attachments,
        array $tools,
        array $guardrails,
        int $projectId
    ): array {
        if ($provider === 'gemini') {
            return $this->runGeminiLoop($apiKey, $model, $temperature, $systemPrompt, $fuzzyContext, $historyRows, $userMessage, $attachments, $tools, $guardrails, $projectId);
        }
        if ($provider === 'claude') {
            return $this->runClaudeLoop($apiKey, $model, $temperature, $systemPrompt, $fuzzyContext, $historyRows, $userMessage, $attachments, $tools, $guardrails, $projectId);
        }

        $endpoint = match ($provider) {
            'groq' => 'https://api.groq.com/openai/v1/chat/completions',
            'deepseek' => 'https://api.deepseek.com/chat/completions',
            default => 'https://api.openai.com/v1/chat/completions',
        };

        return $this->runOpenAICompatibleLoop($endpoint, $provider, $apiKey, $model, $temperature, $systemPrompt, $fuzzyContext, $historyRows, $userMessage, $attachments, $tools, $guardrails, $projectId);
    }

    private function runOpenAICompatibleLoop(
        string $endpoint,
        string $provider,
        string $apiKey,
        string $model,
        float $temperature,
        string $systemPrompt,
        string $fuzzyContext,
        array $historyRows,
        string $userMessage,
        array $attachments,
        array $tools,
        array $guardrails,
        int $projectId
    ): array {
        $messages = [
            ['role' => 'system', 'content' => $systemPrompt . "\n\n" . $fuzzyContext]
        ];

        foreach ($historyRows as $hr) {
            $role = $hr['role'] === 'assistant' ? 'assistant' : 'user';
            $messages[] = ['role' => $role, 'content' => mb_substr((string)$hr['content'], 0, 3000)];
        }

        // Multimodal image blocks only for vision-capable OpenAI models (or ChatGPT)
        $hasImage = false;
        $userParts = [['type' => 'text', 'text' => $userMessage]];
        if ($provider === 'chatgpt') {
            foreach ($attachments as $att) {
                if (!empty($att['is_image']) && !empty($att['base64'])) {
                    $hasImage = true;
                    $userParts[] = [
                        'type' => 'image_url',
                        'image_url' => ['url' => "data:{$att['mime']};base64,{$att['base64']}"]
                    ];
                }
            }
        }
        $messages[] = ['role' => 'user', 'content' => $hasImage ? $userParts : $userMessage];

        $openAiTools = array_map(fn($t) => [
            'type' => 'function',
            'function' => [
                'name' => $t['name'],
                'description' => $t['description'],
                'parameters' => $t['parameters']
            ]
        ], $tools);

        $useTools = !empty($openAiTools);

        for ($turn = 0; $turn < 5; $turn++) {
            $payload = [
                'model' => $model,
                'messages' => $messages,
                'temperature' => $temperature,
            ];
            if ($useTools) {
                $payload['tools'] = $openAiTools;
                $payload['tool_choice'] = 'auto';
            }

            $res = $this->httpPostJson($endpoint, $payload, ['Authorization: Bearer ' . $apiKey]);

            // Retry without native tools if model rejects tool schema (e.g. some OSS / reasoning models)
            if ($res['code'] >= 400 && $useTools && ($turn === 0 || str_contains(json_encode($res['data']), 'tool'))) {
                $useTools = false;
                $turn--;
                continue;
            }

            if ($res['code'] !== 200 || empty($res['data']['choices'][0]['message'])) {
                $errMsg = $res['data']['error']['message'] ?? ($res['error'] ?: "HTTP {$res['code']}");
                return ['success' => false, 'error' => $errMsg];
            }

            $msg = $res['data']['choices'][0]['message'];
            $toolCalls = $msg['tool_calls'] ?? [];

            if (empty($toolCalls)) {
                return ['success' => true, 'reply' => (string)($msg['content'] ?? '')];
            }

            $messages[] = $msg;
            foreach ($toolCalls as $tc) {
                $fnName = $tc['function']['name'] ?? '';
                $fnArgs = json_decode((string)($tc['function']['arguments'] ?? '{}'), true) ?: [];
                $output = $this->dispatchToolCall($fnName, $fnArgs, $guardrails, $projectId);
                $messages[] = [
                    'role' => 'tool',
                    'tool_call_id' => $tc['id'],
                    'content' => json_encode($output, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                ];
            }
        }

        return ['success' => false, 'error' => 'Exceeded max tool execution steps.'];
    }

    private function runGeminiLoop(
        string $apiKey,
        string $model,
        float $temperature,
        string $systemPrompt,
        string $fuzzyContext,
        array $historyRows,
        string $userMessage,
        array $attachments,
        array $tools,
        array $guardrails,
        int $projectId
    ): array {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/" . urlencode($model) . ":generateContent?key=" . urlencode($apiKey);

        $contents = [];
        foreach ($historyRows as $hr) {
            $role = $hr['role'] === 'assistant' ? 'model' : 'user';
            $contents[] = ['role' => $role, 'parts' => [['text' => mb_substr((string)$hr['content'], 0, 3000)]]];
        }

        $userParts = [['text' => $userMessage]];
        foreach ($attachments as $att) {
            if (($att['is_image'] || $att['is_pdf']) && !empty($att['base64'])) {
                $userParts[] = [
                    'inlineData' => [
                        'mimeType' => $att['mime'],
                        'data' => $att['base64']
                    ]
                ];
            }
        }
        $contents[] = ['role' => 'user', 'parts' => $userParts];

        $geminiTools = [['functionDeclarations' => $tools]];

        for ($turn = 0; $turn < 5; $turn++) {
            $payload = [
                'systemInstruction' => ['parts' => [['text' => $systemPrompt . "\n\n" . $fuzzyContext]]],
                'contents' => $contents,
                'tools' => $geminiTools,
                'generationConfig' => ['temperature' => $temperature]
            ];

            $res = $this->httpPostJson($url, $payload);
            if ($res['code'] !== 200 || empty($res['data']['candidates'][0]['content'])) {
                $errMsg = $res['data']['error']['message'] ?? ($res['error'] ?: "Gemini HTTP {$res['code']}");
                return ['success' => false, 'error' => $errMsg];
            }

            $candContent = $res['data']['candidates'][0]['content'];
            $parts = $candContent['parts'] ?? [];

            $functionCalls = [];
            $textParts = [];
            foreach ($parts as $p) {
                if (!empty($p['functionCall'])) {
                    $functionCalls[] = $p['functionCall'];
                } elseif (isset($p['text'])) {
                    $textParts[] = $p['text'];
                }
            }

            if (empty($functionCalls)) {
                return ['success' => true, 'reply' => implode("\n", $textParts)];
            }

            $contents[] = ['role' => 'model', 'parts' => $parts];
            $responseParts = [];
            foreach ($functionCalls as $fc) {
                $fnName = $fc['name'] ?? '';
                $fnArgs = is_array($fc['args'] ?? null) ? $fc['args'] : [];
                $output = $this->dispatchToolCall($fnName, $fnArgs, $guardrails, $projectId);
                $responseParts[] = [
                    'functionResponse' => [
                        'name' => $fnName,
                        'response' => ['result' => $output]
                    ]
                ];
            }
            $contents[] = ['role' => 'user', 'parts' => $responseParts];
        }

        return ['success' => false, 'error' => 'Exceeded max Gemini tool steps.'];
    }

    private function runClaudeLoop(
        string $apiKey,
        string $model,
        float $temperature,
        string $systemPrompt,
        string $fuzzyContext,
        array $historyRows,
        string $userMessage,
        array $attachments,
        array $tools,
        array $guardrails,
        int $projectId
    ): array {
        $url = 'https://api.anthropic.com/v1/messages';
        $headers = [
            'x-api-key: ' . $apiKey,
            'anthropic-version: 2023-06-01'
        ];

        $messages = [];
        foreach ($historyRows as $hr) {
            $role = $hr['role'] === 'assistant' ? 'assistant' : 'user';
            $messages[] = ['role' => $role, 'content' => mb_substr((string)$hr['content'], 0, 3000)];
        }

        $userBlocks = [];
        foreach ($attachments as $att) {
            if (!empty($att['is_image']) && !empty($att['base64'])) {
                $userBlocks[] = [
                    'type' => 'image',
                    'source' => ['type' => 'base64', 'media_type' => $att['mime'], 'data' => $att['base64']]
                ];
            } elseif (!empty($att['is_pdf']) && !empty($att['base64'])) {
                $userBlocks[] = [
                    'type' => 'document',
                    'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $att['base64']]
                ];
            }
        }
        $userBlocks[] = ['type' => 'text', 'text' => $userMessage];
        $messages[] = ['role' => 'user', 'content' => $userBlocks];

        $claudeTools = array_map(fn($t) => [
            'name' => $t['name'],
            'description' => $t['description'],
            'input_schema' => $t['parameters']
        ], $tools);

        for ($turn = 0; $turn < 5; $turn++) {
            $payload = [
                'model' => $model,
                'max_tokens' => 4096,
                'temperature' => $temperature,
                'system' => $systemPrompt . "\n\n" . $fuzzyContext,
                'tools' => $claudeTools,
                'messages' => $messages
            ];

            $res = $this->httpPostJson($url, $payload, $headers);
            if ($res['code'] !== 200 || empty($res['data']['content'])) {
                $errMsg = $res['data']['error']['message'] ?? ($res['error'] ?: "Claude HTTP {$res['code']}");
                return ['success' => false, 'error' => $errMsg];
            }

            $blocks = $res['data']['content'];
            $toolUses = array_values(array_filter($blocks, fn($b) => ($b['type'] ?? '') === 'tool_use'));

            if (empty($toolUses)) {
                $texts = array_map(fn($b) => $b['text'] ?? '', array_filter($blocks, fn($b) => ($b['type'] ?? '') === 'text'));
                return ['success' => true, 'reply' => implode("\n", $texts)];
            }

            $messages[] = ['role' => 'assistant', 'content' => $blocks];
            $toolResults = [];
            foreach ($toolUses as $tu) {
                $output = $this->dispatchToolCall(
                    (string)$tu['name'],
                    (array)($tu['input'] ?? []),
                    $guardrails,
                    $projectId
                );
                $toolResults[] = [
                    'type' => 'tool_result',
                    'tool_use_id' => $tu['id'],
                    'content' => json_encode($output, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                ];
            }
            $messages[] = ['role' => 'user', 'content' => $toolResults];
        }

        return ['success' => false, 'error' => 'Exceeded max Claude tool steps.'];
    }

    private function httpPostJson(string $url, array $payload, array $extraHeaders = [], int $timeout = 45): array
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge(['Content-Type: application/json'], $extraHeaders));
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $raw = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        return [
            'code' => $code,
            'data' => $raw ? (json_decode($raw, true) ?: []) : [],
            'error' => $err
        ];
    }

    /**
     * Local intelligent assistant when external LLM fails or API key is missing,
     * still able to generate real Excel/PDF exports and fuzzy DB lookups!
     */
    private function generateSmartLocalFallback(string $message, string $provider, ?string $apiError, int $projectId, array $guardrails): string
    {
        $lower = strtolower($message);
        $note = $apiError ? "> **Note ({$provider}):** {$apiError} — running via built-in ERP Data Engine.\n\n" : "";

        // Detect direct Excel / PDF request locally
        $statusFilter = '';
        if (str_contains($lower, 'pending')) $statusFilter = 'Pending';
        elseif (str_contains($lower, 'completed')) $statusFilter = 'Completed';
        elseif (str_contains($lower, 'progress')) $statusFilter = 'In Progress';
        elseif (str_contains($lower, 'late')) $statusFilter = 'late';

        $module = 'projects';
        if (str_contains($lower, 'client')) $module = 'clients';
        elseif (str_contains($lower, 'user') || str_contains($lower, 'staff')) $module = 'users';
        elseif (str_contains($lower, 'activity')) $module = 'activity';

        if (str_contains($lower, 'excel') || str_contains($lower, 'xlsx') || str_contains($lower, 'spreadsheet') || str_contains($lower, 'csv')) {
            $res = $this->toolExportExcelReport(ucfirst($module) . ' Export', $module, $statusFilter, $message);
            return $note . "### 📊 Excel Spreadsheet Ready\n- Rows exported: **{$res['row_count']}**\n- {$res['markdown_link']}";
        }

        if (str_contains($lower, 'pdf')) {
            $res = $this->toolGeneratePdfReport(ucfirst($module) . ' Executive Summary', $module, $projectId > 0 ? (string)$projectId : '', $statusFilter, $message, '');
            return $note . "### 📄 PDF Report Ready\n- Rows included: **{$res['row_count']}**\n- {$res['markdown_link']}";
        }

        if ($projectId > 0) {
            $detail = $this->toolGetProjectFullDetails((string)$projectId);
            if (!empty($detail['found'])) {
                $p = $detail['project'];
                $out = $note . "### 📁 [#{$p['id']} - {$p['project_title']}](/projects/view/{$p['id']})\n";
                $out .= "- **Status:** `{$p['project_progress_status']}` | **Due:** `" . ($p['project_due_date'] ?? 'N/A') . "`\n";
                if (!empty($p['project_scope_details_text'])) $out .= "- **Scope:** {$p['project_scope_details_text']}\n";
                return $out;
            }
        }

        $fuzzy = $this->fuzzySearchErp($message, 'all', $statusFilter, 8);
        $out = $note . "### 🔍 Live ERP Fuzzy Search Results\n";
        if (!empty($fuzzy['projects'])) {
            $out .= "\n**Projects:**\n";
            foreach ($fuzzy['projects'] as $p) {
                $out .= "- **[#{$p['id']} - {$p['project_title']}](/projects/view/{$p['id']})** (`{$p['project_progress_status']}` | Due: " . ($p['project_due_date'] ?? 'N/A') . ")\n";
            }
        }
        if (!empty($fuzzy['clients'])) {
            $out .= "\n**Clients:**\n";
            foreach ($fuzzy['clients'] as $c) {
                $out .= "- **{$c['name']}** ({$c['email']} | {$c['phone']})\n";
            }
        }
        if (!empty($fuzzy['users'])) {
            $out .= "\n**Staff / Users:**\n";
            foreach ($fuzzy['users'] as $u) {
                $out .= "- **" . ($u['full_name'] ?: $u['username']) . "** (`@{$u['username']}` | {$u['role_name']} | {$u['status']})\n";
            }
        }
        if (empty($fuzzy['projects']) && empty($fuzzy['clients']) && empty($fuzzy['users'])) {
            $out .= "No direct matches found. Please configure a valid API key in [AI Model Settings](/settings/ai-models) for full conversational reasoning.";
        }
        return $out;
    }
}
