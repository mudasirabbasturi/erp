<?php
namespace App\Services;

use Exception;

class GoogleDriveService
{
    private string $credentialsPath;
    private string $folderId;
    private string $authMode = 'service_account';
    private string $oauthClientId = '';
    private string $oauthClientSecret = '';
    private string $oauthRefreshToken = '';
    private ?string $accessToken = null;
    private int $tokenExpiresAt = 0;

    public function __construct(?string $credentialsPath = null, ?string $folderId = null, ?array $oauthConfig = null)
    {
        $this->credentialsPath = $credentialsPath ?: (getenv('GOOGLE_APPLICATION_CREDENTIALS') ?: __DIR__ . '/../../storage/keys/google-service-account.json');
        $this->folderId = $folderId ?: (getenv('GOOGLE_DRIVE_FOLDER_ID') ?: '1FuuCUVEv-jNQfufj-8g4IkSO0RP6s1XX');

        if ($oauthConfig) {
            $this->authMode = $oauthConfig['auth_mode'] ?? 'service_account';
            $this->oauthClientId = (string)($oauthConfig['client_id'] ?? '');
            $this->oauthClientSecret = (string)($oauthConfig['client_secret'] ?? '');
            $this->oauthRefreshToken = (string)($oauthConfig['refresh_token'] ?? '');
        }
    }

    /**
     * Load GoogleDriveService configured from tracker_settings in database.
     */
    public static function fromDatabase(?string $folderIdOverride = null): self
    {
        $row = null;
        if (class_exists('\Core\Database')) {
            $row = \Core\Database::fetchOne("SELECT * FROM tracker_settings ORDER BY id ASC LIMIT 1");
        }

        $folderId = $folderIdOverride ?: ($row['google_drive_folder_id'] ?? null);
        $oauthConfig = null;
        if ($row && ($row['google_auth_mode'] ?? 'service_account') === 'oauth2') {
            $oauthConfig = [
                'auth_mode' => 'oauth2',
                'client_id' => $row['google_oauth_client_id'] ?? '',
                'client_secret' => $row['google_oauth_client_secret'] ?? '',
                'refresh_token' => $row['google_oauth_refresh_token'] ?? '',
            ];
        }

        return new self(null, $folderId, $oauthConfig);
    }

    /**
     * Get OAuth2 Bearer Access Token (via User OAuth2 Refresh Token or Service Account JWT).
     */
    public function getAccessToken(): string
    {
        if ($this->accessToken && time() < ($this->tokenExpiresAt - 60)) {
            return $this->accessToken;
        }

        if ($this->authMode === 'oauth2') {
            return $this->getOAuth2AccessToken();
        }

        return $this->getServiceAccountAccessToken();
    }

    /**
     * Exchange OAuth2 Refresh Token for an Access Token (uses personal Google Drive quota).
     */
    private function getOAuth2AccessToken(): string
    {
        if (!$this->oauthClientId || !$this->oauthClientSecret || !$this->oauthRefreshToken) {
            throw new Exception("Google OAuth 2.0 is selected, but Client ID, Client Secret, or Refresh Token is missing. Please connect your Google account in Settings.");
        }

        $now = time();
        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'client_id' => $this->oauthClientId,
            'client_secret' => $this->oauthClientSecret,
            'refresh_token' => $this->oauthRefreshToken,
            'grant_type' => 'refresh_token',
        ]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            throw new Exception("Failed to contact Google OAuth2 token endpoint: " . $curlError);
        }

        $data = json_decode($response, true);
        if ($httpCode !== 200 || empty($data['access_token'])) {
            throw new Exception("Google OAuth2 refresh error ({$httpCode}): " . ($data['error_description'] ?? $data['error'] ?? $response));
        }

        $this->accessToken = $data['access_token'];
        $this->tokenExpiresAt = $now + (int)($data['expires_in'] ?? 3600);

        return $this->accessToken;
    }

    /**
     * Get OAuth2 Bearer Access Token using Service Account JWT.
     */
    private function getServiceAccountAccessToken(): string
    {

        if (!file_exists($this->credentialsPath)) {
            throw new Exception("Google Service Account credentials file not found: " . $this->credentialsPath);
        }

        $json = json_decode(file_get_contents($this->credentialsPath), true);
        if (!$json || empty($json['client_email']) || empty($json['private_key'])) {
            throw new Exception("Invalid Google Service Account JSON credentials.");
        }

        $now = time();
        $jwtHeader = self::base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $jwtClaim = self::base64UrlEncode(json_encode([
            'iss' => $json['client_email'],
            'scope' => 'https://www.googleapis.com/auth/drive',
            'aud' => 'https://oauth2.googleapis.com/token',
            'exp' => $now + 3600,
            'iat' => $now
        ]));

        $signatureInput = $jwtHeader . '.' . $jwtClaim;
        $binarySignature = '';
        $privateKey = openssl_pkey_get_private($json['private_key']);
        if (!$privateKey) {
            throw new Exception("Unable to parse private key from Google Service Account credentials: " . openssl_error_string());
        }

        $success = openssl_sign($signatureInput, $binarySignature, $privateKey, OPENSSL_ALGO_SHA256);
        if (!$success) {
            throw new Exception("Unable to sign JWT for Google Drive API.");
        }

        $jwt = $signatureInput . '.' . self::base64UrlEncode($binarySignature);

        // Exchange JWT for Access Token
        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt
        ]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            throw new Exception("Failed to contact Google OAuth2 token endpoint: " . $curlError);
        }

        $data = json_decode($response, true);
        if ($httpCode !== 200 || empty($data['access_token'])) {
            throw new Exception("Google OAuth2 token error ({$httpCode}): " . ($data['error_description'] ?? $response));
        }

        $this->accessToken = $data['access_token'];
        $this->tokenExpiresAt = $now + (int)($data['expires_in'] ?? 3600);

        return $this->accessToken;
    }

    /**
     * Upload a file buffer or stream directly to Google Drive.
     *
     * @param string $binaryContent Binary content of the file
     * @param string $filename Name of the file in Google Drive
     * @param string $mimeType e.g. 'image/jpeg'
     * @param array $extraParents Optional parent folders
     * @return array [id, name, webViewLink, thumbnailLink]
     */
    public function uploadFile(string $binaryContent, string $filename, string $mimeType = 'image/jpeg', array $extraParents = []): array
    {
        $token = $this->getAccessToken();
        $parents = !empty($extraParents) ? $extraParents : [$this->folderId];

        $metadata = [
            'name' => $filename,
            'parents' => $parents,
            'mimeType' => $mimeType
        ];

        $boundary = '-------314159265358979323846';
        $delimiter = "\r\n--" . $boundary . "\r\n";
        $closeDelimiter = "\r\n--" . $boundary . "--";

        $multipartRequestBody =
            $delimiter .
            "Content-Type: application/json; charset=UTF-8\r\n\r\n" .
            json_encode($metadata) .
            $delimiter .
            "Content-Type: " . $mimeType . "\r\n\r\n" .
            $binaryContent .
            $closeDelimiter;

        $url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,thumbnailLink,webContentLink,size';

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $multipartRequestBody);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: multipart/related; boundary=' . $boundary,
            'Content-Length: ' . strlen($multipartRequestBody)
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            throw new Exception("cURL error during Google Drive upload: " . $curlError);
        }

        $res = json_decode($response, true);
        if ($httpCode !== 200 || empty($res['id'])) {
            throw new Exception("Google Drive upload failed ({$httpCode}): " . ($res['error']['message'] ?? $response));
        }

        // Generate public/direct viewing link using file ID
        $fileId = $res['id'];
        $viewLink = "https://lh3.googleusercontent.com/u/0/d/{$fileId}";
        $thumbnailLink = "https://lh3.googleusercontent.com/u/0/d/{$fileId}=w400-h250-p-k-no";

        return [
            'id' => $fileId,
            'name' => $res['name'] ?? $filename,
            'webViewLink' => $res['webViewLink'] ?? $viewLink,
            'thumbnailLink' => $thumbnailLink,
            'size' => $res['size'] ?? strlen($binaryContent)
        ];
    }

    /**
     * Download binary content of a file from Google Drive.
     *
     * @return array{content: string, contentType: string}
     */
    public function downloadFile(string $fileId): array
    {
        $token = $this->getAccessToken();
        $url = 'https://www.googleapis.com/drive/v3/files/' . urlencode($fileId) . '?alt=media&supportsAllDrives=true';

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $content = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'image/jpeg';
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            throw new Exception("cURL error downloading from Google Drive: " . $curlError);
        }

        if ($httpCode !== 200 || $content === false) {
            throw new Exception("Google Drive download failed ({$httpCode})");
        }

        return [
            'content' => $content,
            'contentType' => $contentType
        ];
    }

    /**
     * Delete a file from Google Drive.
     */
    public function deleteFile(string $fileId): bool
    {
        try {
            $token = $this->getAccessToken();
            $url = 'https://www.googleapis.com/drive/v3/files/' . urlencode($fileId) . '?supportsAllDrives=true';

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $token
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            return ($httpCode === 204 || $httpCode === 200 || $httpCode === 404);
        } catch (Exception $e) {
            error_log("GoogleDriveService::deleteFile error: " . $e->getMessage());
            return false;
        }
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

