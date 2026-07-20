<?php
// Set headers for CORS and JSON output
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ─── CONFIGURATION ───
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 465); // SSL
define('SMTP_USER', 'sipl.connect@gmail.com');
define('SMTP_PASS', 'yfuvjcmelladzopg'); // Your Gmail App Password
define('SMTP_SENDER', 'Subset Industries Pvt. Ltd. <sipl.connect@gmail.com>');
define('REPLY_TO', 'sales@subsetpens.com');
define('CATALOGUE_URL', 'https://drive.google.com/drive/u/4/folders/18udstLL0iFI0tnOV5zwypuuJCs4OjDOK');

// Data storage files
define('LEADS_FILE', __DIR__ . '/leads.json');
define('LOGS_FILE', __DIR__ . '/logs.json');

// Initialize database files if missing
if (!file_exists(LEADS_FILE)) {
    file_put_contents(LEADS_FILE, json_encode([], JSON_PRETTY_PRINT));
}
if (!file_exists(LOGS_FILE)) {
    file_put_contents(LOGS_FILE, json_encode([], JSON_PRETTY_PRINT));
}

// Helper: Add log
function addLog($type, $recipient, $status, $message, $error = null) {
    $logs = json_decode(file_get_contents(LOGS_FILE), true) ?: [];
    $newLog = [
        'id' => '_' . uniqid(),
        'type' => $type,
        'recipient' => $recipient,
        'status' => $status,
        'message' => $message,
        'error' => $error,
        'timestamp' => date('c')
    ];
    array_unshift($logs, $newLog);
    // Keep last 300 logs
    file_put_contents(LOGS_FILE, json_encode(array_slice($logs, 0, 300), JSON_PRETTY_PRINT));
}

// Helper: Get database contents
function getLeads() {
    return json_decode(file_get_contents(LEADS_FILE), true) ?: [];
}

function saveLeads($leads) {
    file_put_contents(LEADS_FILE, json_encode($leads, JSON_PRETTY_PRINT));
}

// ─── SMTP SENDER FUNCTION (Pure PHP Socket) ───
function sendSmtpEmail($to, $subject, $html, $attachments = []) {
    $host = SMTP_HOST;
    $port = SMTP_PORT;
    $user = SMTP_USER;
    $pass = SMTP_PASS;
    $sender = SMTP_SENDER;

    $connection = fsockopen("ssl://" . $host, $port, $errno, $errstr, 15);
    if (!$connection) {
        throw new Exception("Connection failed: $errstr ($errno)");
    }

    $responses = [];
    $responses[] = fgets($connection, 512);

    fwrite($connection, "EHLO localhost\r\n");
    $responses[] = fgets($connection, 512);
    while (substr(end($responses), 3, 1) === '-') {
        $responses[] = fgets($connection, 512);
    }

    fwrite($connection, "AUTH LOGIN\r\n");
    $responses[] = fgets($connection, 512);

    fwrite($connection, base64_encode($user) . "\r\n");
    $responses[] = fgets($connection, 512);

    fwrite($connection, base64_encode($pass) . "\r\n");
    $auth_res = fgets($connection, 512);
    if (strpos($auth_res, '235') === false) {
        fclose($connection);
        throw new Exception("Authentication failed: " . trim($auth_res));
    }

    fwrite($connection, "MAIL FROM: <$user>\r\n");
    $responses[] = fgets($connection, 512);

    fwrite($connection, "RCPT TO: <$to>\r\n");
    $responses[] = fgets($connection, 512);

    fwrite($connection, "DATA\r\n");
    $responses[] = fgets($connection, 512);

    // Build Email Body (Supporting attachments if any)
    $boundary = "SUBSET_LIMIT_" . md5(uniqid(microtime(), true));

    $headers = "From: $sender\r\n" .
               "Reply-To: " . REPLY_TO . "\r\n" .
               "To: $to\r\n" .
               "Subject: $subject\r\n" .
               "MIME-Version: 1.0\r\n" .
               "X-Mailer: Subset Expo PHP System\r\n" .
               "List-Unsubscribe: <mailto:" . REPLY_TO . "?subject=Unsubscribe>\r\n" .
               "Precedence: bulk\r\n";

    if (!empty($attachments)) {
        $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n\r\n";
        
        $body = "--$boundary\r\n" .
                "Content-Type: text/html; charset=UTF-8\r\n" .
                "Content-Transfer-Encoding: 7bit\r\n\r\n" .
                $html . "\r\n\r\n";

        foreach ($attachments as $att) {
            $body .= "--$boundary\r\n" .
                     "Content-Type: application/octet-stream; name=\"" . $att['name'] . "\"\r\n" .
                     "Content-Transfer-Encoding: base64\r\n" .
                     "Content-Disposition: attachment; filename=\"" . $att['name'] . "\"\r\n\r\n" .
                     chunk_split($att['content']) . "\r\n\r\n";
        }
        $body .= "--$boundary--";
    } else {
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n\r\n";
        $body = $html;
    }

    fwrite($connection, $headers . $body . "\r\n.\r\n");
    $responses[] = fgets($connection, 512);

    fwrite($connection, "QUIT\r\n");
    fclose($connection);
    return true;
}

// ─── EMAIL TEMPLATE GENERATOR ───
function buildEmailHtml($name) {
    return '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Subset Industries – Paperworld Expo</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:\'Helvetica Neue\',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:28px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <!-- Header — clean company name, spam-safe -->
        <tr>
          <td style="background:#111111;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 6px;color:#e11d48;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">EST. JUNE 2024</p>
            <p style="margin:0;font-family:\'Helvetica Neue\',Arial,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
              Subset Industries Pvt. Ltd.<sup style="font-size:14px;color:#e11d48;font-weight:700;">&reg;</sup>
            </p>
            <p style="margin:8px 0 0;font-size:11px;letter-spacing:4px;color:#888888;text-transform:uppercase;">The Pen Makers</p>
          </td>
        </tr>
        <!-- Expo Banner -->
        <tr>
          <td style="background:#e11d48;padding:16px 40px;text-align:center;">
            <p style="margin:0 0 4px;color:#fff;font-size:14px;font-weight:700;letter-spacing:0.5px;">
              📍 Paperworld Expo &nbsp;·&nbsp; Stall No. D44
            </p>
            <p style="margin:0;color:rgba(255,255,255,0.85);font-size:12px;font-weight:500;">
              Hall No. 6, Bharat Mandapam, Pragati Maidan &nbsp;|&nbsp; 30th July – 1st August 2025
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;color:#1a1a1a;font-size:16px;line-height:1.6;">
              Dear <strong>' . htmlspecialchars($name) . '</strong>,
            </p>
            <p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.7;">
              Thank you for visiting the <strong>Subset Industries</strong> stall at the expo! We are delighted to connect with you and hope you enjoyed exploring our range of writing instruments and corporate gifting solutions.
            </p>
            <p style="margin:0 0 24px;color:#444;font-size:15px;line-height:1.7;">
              Founded in June 2024, Subset Industries is led by a founder with <strong>35+ years of experience</strong> in the pen manufacturing industry. We specialise in ball pens, metal pens, roller pens, fountain pens, diary gift sets, keychain pen sets, and fully customisable corporate gifting solutions — delivered Pan India.
            </p>
            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#e11d48;border-radius:8px;">
                  <a href="' . CATALOGUE_URL . '" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
                    View Our Product Catalogue &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;color:#999;font-size:12px;font-style:italic;">
              This email is for outreach purposes only. We respect your privacy and will not share your information with third parties.
            </p>
          </td>
        </tr>
        <!-- Divider -->
        <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #eee;" /></td></tr>
        <!-- Contact Info -->
        <tr>
          <td style="padding:28px 40px;">
            <p style="margin:0 0 14px;color:#111;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Get In Touch</p>
            <p style="margin:0 0 8px;color:#555;font-size:14px;">📧 <a href="mailto:sales@subsetpens.com" style="color:#e11d48;text-decoration:none;">sales@subsetpens.com</a></p>
            <p style="margin:0 0 8px;color:#555;font-size:14px;">📞 / 💬 <a href="https://wa.me/919727179186" style="color:#e11d48;text-decoration:none;">+91 97271 79186</a> <span style="color:#aaa;font-size:12px;">(WhatsApp available)</span></p>
            <p style="margin:0 0 8px;color:#555;font-size:14px;">🌐 <a href="https://www.subsetindustries.com" style="color:#e11d48;text-decoration:none;">www.subsetindustries.com</a></p>
          </td>
        </tr>
        <!-- Social Links -->
        <tr>
          <td style="padding:0 40px 28px;">
            <p style="margin:0 0 12px;color:#111;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Follow Us</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:10px;">
                  <a href="https://www.instagram.com/subsetindustries" style="display:inline-block;background:#f0f0f0;border-radius:6px;padding:8px 14px;color:#333;font-size:13px;text-decoration:none;font-weight:600;">
                    📸 Instagram
                  </a>
                </td>
                <td style="padding-right:10px;">
                  <a href="https://www.facebook.com/SubsetIndustriesPvtLtd" style="display:inline-block;background:#f0f0f0;border-radius:6px;padding:8px 14px;color:#333;font-size:13px;text-decoration:none;font-weight:600;">
                    👍 Facebook
                  </a>
                </td>
                <td>
                  <a href="https://www.linkedin.com/company/subset-industries" style="display:inline-block;background:#f0f0f0;border-radius:6px;padding:8px 14px;color:#333;font-size:13px;text-decoration:none;font-weight:600;">
                    💼 LinkedIn
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#111111;padding:20px 40px;text-align:center;">
            <p style="margin:0 0 4px;color:#666;font-size:12px;">Subset Industries Pvt. Ltd. &middot; www.subsetindustries.com</p>
            <p style="margin:0;color:#555;font-size:11px;">You are receiving this because you registered at our expo booth. For queries: sales@subsetpens.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>';
}

// ─── API HANDLERS ───
$action = $_GET['action'] ?? '';
$action = ltrim($action, '/'); // remove leading slash
$action = preg_replace('/^api\//', '', $action); // remove leading "api/" if present


// GET: Fetch Leads
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'leads') {
    echo json_encode(getLeads());
    exit();
}

// GET: Fetch Logs
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'logs') {
    echo json_encode(json_decode(file_get_contents(LOGS_FILE), true) ?: []);
    exit();
}

// GET: Stats
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'stats') {
    $leads = getLeads();
    $totalLeads = count($leads);
    
    $emailSent = 0; $emailFailed = 0; $emailPending = 0;
    $interactions = 0; $sampleRequests = 0;
    
    foreach ($leads as $l) {
        $emailStatus = $l['status']['email'] ?? 'pending';
        if ($emailStatus === 'sent') $emailSent++;
        elseif ($emailStatus === 'failed') $emailFailed++;
        else $emailPending++;
        
        $interactions += count($l['interactions'] ?? []);
        foreach ($l['interactions'] ?? [] as $i) {
            if (($i['action'] ?? '') === 'request_sample') {
                $sampleRequests++;
            }
        }
    }
    
    echo json_encode([
        'totalLeads' => $totalLeads,
        'totalInteractions' => $interactions,
        'sampleRequests' => $sampleRequests,
        'emailStats' => ['sent' => $emailSent, 'failed' => $emailFailed, 'pending' => $emailPending],
        'smsStats' => ['sent' => 0, 'failed' => 0, 'pending' => 0], // SMS skipped
        'timeline' => [],
        'recentLogs' => array_slice(json_decode(file_get_contents(LOGS_FILE), true) ?: [], 0, 10)
    ]);
    exit();
}

// GET: Config Config Mock (for Frontend Admin UI compatibility)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'config') {
    echo json_encode([
        'smtpHost' => SMTP_HOST,
        'smtpPort' => SMTP_PORT,
        'smtpUser' => SMTP_USER,
        'smtpPass' => '********',
        'smtpSender' => SMTP_SENDER,
        'catalogueUrl' => CATALOGUE_URL
    ]);
    exit();
}

// State storage file
define('STATE_FILE', __DIR__ . '/state.json');

function getState() {
    return json_decode(@file_get_contents(STATE_FILE), true) ?: ['last_reported_count' => 0];
}

function saveState($state) {
    file_put_contents(STATE_FILE, json_encode($state, JSON_PRETTY_PRINT));
}

// ─── ORGANIZED CSV & EMAIL BATCH REPORT SENDER ───
function sendBatchLeadReport($leads, $isManual = false) {
    $totalLeads = count($leads);
    $state = getState();
    $lastReported = $state['last_reported_count'] ?? 0;
    $newLeadsCount = $totalLeads - $lastReported;
    
    // Sort leads chronologically for the CSV export (oldest first)
    $chronologicalLeads = array_reverse($leads);
    
    // Build organized CSV
    $csv = "Sr No,Lead Name,Mobile Number,Email Address,Company Name,Date (IST),Time (IST),Email Status,Engagements,Sample Requested\n";
    $srNo = 1;
    foreach ($chronologicalLeads as $l) {
        $dt = new DateTime($l['timestamp'] ?? 'now');
        $dt->setTimezone(new DateTimeZone('Asia/Kolkata'));
        $dateStr = $dt->format('d-M-Y');
        $timeStr = $dt->format('h:i A');
        
        $name = '"' . str_replace('"', '""', $l['name']) . '"';
        $phone = '"' . str_replace('"', '""', $l['phone']) . '"';
        $email = '"' . str_replace('"', '""', $l['email']) . '"';
        $company = '"' . str_replace('"', '""', $l['company']) . '"';
        $status = $l['status']['email'] ?? 'pending';
        $interactionsCount = count($l['interactions'] ?? []);
        
        $sampleReq = 'No';
        foreach ($l['interactions'] ?? [] as $i) {
            if (($i['action'] ?? '') === 'request_sample') {
                $sampleReq = 'Yes';
                break;
            }
        }
        
        $csv .= "$srNo,$name,$phone,$email,$company,$dateStr,$timeStr,$status,$interactionsCount,$sampleReq\n";
        $srNo++;
    }
    
    // Top 10 newest leads preview for email body
    $recent10 = array_slice($leads, 0, 10);
    $tableRowsHtml = '';
    foreach ($recent10 as $l) {
        $dt = new DateTime($l['timestamp'] ?? 'now');
        $dt->setTimezone(new DateTimeZone('Asia/Kolkata'));
        $timeStr = $dt->format('d-M-Y h:i A');
        $tableRowsHtml .= '
          <tr>
            <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px;color:#111;"><strong>' . htmlspecialchars($l['name']) . '</strong></td>
            <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px;color:#555;">' . htmlspecialchars($l['company']) . '</td>
            <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px;color:#555;">' . htmlspecialchars($l['phone']) . '</td>
            <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px;color:#e11d48;">' . htmlspecialchars($l['email']) . '</td>
            <td style="padding:10px;border-bottom:1px solid #eee;font-size:12px;color:#777;">' . $timeStr . '</td>
          </tr>';
    }
    
    $subject = $isManual 
        ? "Subset Industries - Manual Lead Export ($totalLeads Total Leads)"
        : "Subset Industries - 10 New Leads Alert ($totalLeads Total Leads)";
        
    $html = '
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:\'Helvetica Neue\',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
            <!-- Header -->
            <tr>
              <td style="background:#111111;padding:24px 30px;text-align:center;">
                <p style="margin:0;color:#e11d48;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">EXPO LEAD SYSTEM</p>
                <p style="margin:6px 0 0;font-size:22px;font-weight:900;color:#ffffff;">Subset Industries Pvt. Ltd.&reg;</p>
              </td>
            </tr>
            <!-- Summary Bar -->
            <tr>
              <td style="background:#e11d48;padding:14px 30px;color:#ffffff;font-size:13px;text-align:center;font-weight:600;">
                📊 Batch Notification &nbsp;|&nbsp; ' . ($isManual ? 'Manual Trigger' : '10 New Leads Threshold Reached') . '
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:28px 30px;">
                <p style="margin:0 0 16px;color:#222;font-size:15px;">Hello Sales Team,</p>
                <p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.6;">
                  A new milestone has been reached! You have collected <strong>' . $totalLeads . ' total leads</strong> at the booth. The full organized CSV report is attached to this email.
                </p>
                
                <!-- Metrics Box -->
                <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8f9fa;border-radius:8px;margin-bottom:24px;border:1px solid #eaebec;">
                  <tr>
                    <td align="center" width="50%" style="border-right:1px solid #eaebec;">
                      <span style="display:block;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:1px;">New Leads in Batch</span>
                      <span style="display:block;font-size:24px;font-weight:800;color:#e11d48;margin-top:4px;">' . ($isManual ? $newLeadsCount : 10) . '</span>
                    </td>
                    <td align="center" width="50%">
                      <span style="display:block;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:1px;">Total Leads to Date</span>
                      <span style="display:block;font-size:24px;font-weight:800;color:#111;margin-top:4px;">' . $totalLeads . '</span>
                    </td>
                  </tr>
                </table>
                
                <h3 style="font-size:14px;color:#111;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Recent Submissions Preview</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee;">
                  <thead>
                    <tr style="background:#f0f0f0;text-align:left;">
                      <th style="padding:10px;font-size:11px;color:#666;text-transform:uppercase;">Name</th>
                      <th style="padding:10px;font-size:11px;color:#666;text-transform:uppercase;">Company</th>
                      <th style="padding:10px;font-size:11px;color:#666;text-transform:uppercase;">Phone</th>
                      <th style="padding:10px;font-size:11px;color:#666;text-transform:uppercase;">Email</th>
                      <th style="padding:10px;font-size:11px;color:#666;text-transform:uppercase;">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    ' . $tableRowsHtml . '
                  </tbody>
                </table>
                <p style="margin:20px 0 0;font-size:12px;color:#888;font-style:italic;">
                  * Complete lead details, interaction metrics, and full contact history are included in the attached CSV file.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background:#f0f0f0;padding:16px 30px;text-align:center;font-size:11px;color:#777;">
                Subset Industries Pvt. Ltd. &middot; Automated Expo Lead Tracking System
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>';

    $attachment = [
        'name' => 'Subset_Expo_Leads_Report_' . date('Y-m-d_H-i') . '.csv',
        'content' => base64_encode($csv)
    ];

    sendSmtpEmail('sales@subsetpens.com', $subject, $html, [$attachment]);
    
    // Save updated reported state
    $state['last_reported_count'] = $totalLeads;
    saveState($state);
    addLog('email', 'sales@subsetpens.com', 'success', "Sent batch CSV lead report ($totalLeads total leads).");
}

// POST: Add Lead
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'leads') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data['name']) || empty($data['phone']) || empty($data['email']) || empty($data['company'])) {
        http_response_code(400);
        echo json_encode(['error' => 'All fields are required']);
        exit();
    }
    
    $leads = getLeads();
    $newLead = [
        'id' => '_' . uniqid(),
        'name' => trim($data['name']),
        'phone' => trim($data['phone']),
        'email' => trim($data['email']),
        'company' => trim($data['company']),
        'timestamp' => date('c'),
        'status' => ['email' => 'pending', 'sms' => 'success'],
        'interactions' => []
    ];
    
    // Add lead to stack
    array_unshift($leads, $newLead);
    saveLeads($leads);
    
    // Output success response immediately (saves response time for user UI)
    echo json_encode([
        'message' => 'Lead created successfully',
        'leadId' => $newLead['id'],
        'redirectUrl' => CATALOGUE_URL
    ]);
    
    // Send SMTP Email (Non-blocking response has already been sent if PHP output buffer is flushed)
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request(); // speeds up UI redirection
    }
    
    try {
        $subject = "Welcome to Subset Industries – Great Meeting You!";
        $html = buildEmailHtml($newLead['name']);
        sendSmtpEmail($newLead['email'], $subject, $html);
        
        // Update lead status
        $leads = getLeads();
        foreach ($leads as &$l) {
            if ($l['id'] === $newLead['id']) {
                $l['status']['email'] = 'sent';
                break;
            }
        }
        saveLeads($leads);
        addLog('email', $newLead['email'], 'success', "Email sent successfully to " . $newLead['email']);
    } catch (Exception $e) {
        $leads = getLeads();
        foreach ($leads as &$l) {
            if ($l['id'] === $newLead['id']) {
                $l['status']['email'] = 'failed';
                break;
            }
        }
        saveLeads($leads);
        addLog('email', $newLead['email'], 'failed', "Failed to send email: " . $e->getMessage());
    }

    // Check if 10 new leads threshold reached
    $totalCount = count($leads);
    $state = getState();
    $lastCount = $state['last_reported_count'] ?? 0;
    
    if (($totalCount - $lastCount) >= 10) {
        try {
            sendBatchLeadReport($leads, false);
        } catch (Exception $e) {
            addLog('email', 'sales@subsetpens.com', 'failed', "Batch report failed: " . $e->getMessage());
        }
    }
    exit();
}

// POST: Add Interaction
if ($_SERVER['REQUEST_METHOD'] === 'POST' && preg_match('/^leads\/([^\/]+)\/interaction$/', $action, $matches)) {
    $leadId = $matches[1];
    $data = json_decode(file_get_contents('php://input'), true);
    
    $leads = getLeads();
    $found = false;
    foreach ($leads as &$l) {
        if ($l['id'] === $leadId) {
            $l['interactions'][] = [
                'action' => $data['action'] ?? '',
                'details' => $data['details'] ?? '',
                'timestamp' => date('c')
            ];
            $found = true;
            break;
        }
    }
    if ($found) {
        saveLeads($leads);
        echo json_encode(['message' => 'Interaction logged successfully']);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Lead not found']);
    }
    exit();
}

// POST: Trigger Daily CSV Report Email
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'trigger-daily-summary') {
    $leads = getLeads();
    try {
        sendBatchLeadReport($leads, true);
        echo json_encode(['message' => 'Lead report emailed successfully to sales@subsetpens.com']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to send lead report', 'details' => $e->getMessage()]);
    }
    exit();
}

http_response_code(404);
echo json_encode(['error' => 'Not found']);
exit();
?>
