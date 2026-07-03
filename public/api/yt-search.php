<?php
/**
 * YouTube search proxy for usdx-editor.
 *
 * Keeps the YouTube Data API key server-side — the browser only ever talks to
 * this endpoint, so the key never appears in the shipped JS bundle.
 *
 * Setup (one-time, via FTP):
 *   Place a file named  usdx-editor-yt-key.php  TWO directory levels ABOVE the
 *   app's deploy directory — i.e. next to the webroot folder, outside of it:
 *
 *     /               ← FTP root: usdx-editor-yt-key.php goes HERE
 *     └── httpdocs/           (webroot — name varies by host)
 *         └── usdx-editor/    (deploy directory)
 *             └── api/yt-search.php
 *
 *   File content:
 *
 *     <?php return 'AIza...your-key...';
 *
 *   Living outside the webroot means the file is not reachable over HTTP at
 *   all, and deployments never touch it. If the search stays dead after
 *   setup, the host may block PHP from reading above the webroot
 *   (open_basedir) — then move the file one level down (next to the
 *   usdx-editor/ folder) and change the dirname() level below from 3 to 2.
 *
 *   Recommended key settings in the Google Cloud console:
 *   - API restriction: YouTube Data API v3 only
 *   - Quota cap: low daily limit (searches cost 100 units each)
 *   - No referrer restriction (calls originate from this server, not a browser)
 *
 * Response contract (mirrors the frontend's SearchOutcome):
 *   { "kind": "results", "items": [{ videoId, title, author, year }] }
 *   { "kind": "quota" }
 *   { "kind": "error" }
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $body): void
{
    echo json_encode($body);
    exit;
}

$q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
if ($q === '' || mb_strlen($q) > 200) {
    respond(['kind' => 'error']);
}

// Key file lives outside the webroot so it is unreachable over HTTP and
// deployments never touch it (api/ → usdx-editor/ → webroot → FTP root)
$keyFile = dirname(__DIR__, 3) . '/usdx-editor-yt-key.php';
if (!is_file($keyFile)) {
    respond(['kind' => 'error']);
}
$key = require $keyFile;
if (!is_string($key) || $key === '') {
    respond(['kind' => 'error']);
}

$url = 'https://www.googleapis.com/youtube/v3/search'
     . '?key=' . rawurlencode($key)
     . '&q=' . rawurlencode($q)
     . '&type=video&part=snippet&maxResults=5';

$ctx = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true]]);
$raw = @file_get_contents($url, false, $ctx);
if ($raw === false) {
    respond(['kind' => 'error']);
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    respond(['kind' => 'error']);
}

if (isset($data['error'])) {
    $reason = $data['error']['errors'][0]['reason'] ?? '';
    $isQuota = $reason === 'quotaExceeded' || $reason === 'dailyLimitExceeded';
    respond(['kind' => $isQuota ? 'quota' : 'error']);
}

// Google returns HTML entities in titles/channel names — decode them here so
// the client never has to touch innerHTML for decoding.
$items = [];
foreach (($data['items'] ?? []) as $item) {
    $videoId = $item['id']['videoId'] ?? null;
    if (!is_string($videoId) || $videoId === '') {
        continue;
    }
    $published = $item['snippet']['publishedAt'] ?? '';
    $items[] = [
        'videoId' => $videoId,
        'title'   => html_entity_decode((string) ($item['snippet']['title'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'author'  => html_entity_decode((string) ($item['snippet']['channelTitle'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'year'    => is_string($published) && strlen($published) >= 4 ? substr($published, 0, 4) : '',
    ];
}

respond(['kind' => 'results', 'items' => $items]);
