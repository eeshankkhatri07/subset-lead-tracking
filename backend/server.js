import express from 'express';
import { LOGO_BASE64 } from './emailLogo.js';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Local encryption key management
const SECRET_KEY_FILE = path.resolve('secret.key');
let encryptionKey;

if (fs.existsSync(SECRET_KEY_FILE)) {
  encryptionKey = fs.readFileSync(SECRET_KEY_FILE).slice(0, 32);
} else {
  // Generate key
  encryptionKey = crypto.randomBytes(32);
  fs.writeFileSync(SECRET_KEY_FILE, encryptionKey);
}

// AES-256-GCM Authenticated Encryption Helper
const encrypt = (text) => {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
};

// AES-256-GCM Authenticated Decryption Helper
const decrypt = (encryptedText) => {
  if (!encryptedText) return '';
  if (!encryptedText.includes(':')) return encryptedText;
  
  try {
    const [ivHex, encrypted, authTagHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return encryptedText;
  }
};

// Persistent database file paths
const LEADS_FILE = path.resolve('leads.json');
const CONFIG_FILE = path.resolve('config.json');
const LOGS_FILE = path.resolve('logs.json');

// Always write fresh Brevo config on every startup so encryption key stays in sync
const initDB = () => {
  if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
  }

  // Preserve existing leads/logs but always re-encrypt credentials with current key
  let existingConfig = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try { existingConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch(e) {}
  }

  const freshConfig = {
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpSecure: false,
    smtpUser: 'sipl.connect@gmail.com',
    smtpPass: encrypt('yfuvjcmelladzopg'),
    smtpSender: 'Subset Industries Pvt. Ltd. <sipl.connect@gmail.com>',
    smsGateway: existingConfig.smsGateway || 'mock',
    twilioSid: existingConfig.twilioSid || '',
    twilioAuthToken: existingConfig.twilioAuthToken ? encrypt(decrypt(existingConfig.twilioAuthToken)) : '',
    twilioNumber: existingConfig.twilioNumber || '',
    catalogueUrl: existingConfig.catalogueUrl || 'https://drive.google.com/drive/u/4/folders/18udstLL0iFI0tnOV5zwypuuJCs4OjDOK',
    emailTemplateSubject: existingConfig.emailTemplateSubject || 'Great Meeting You at Paperworld Expo \u2013 Subset Industries',
    emailTemplateBody: '',
    smsTemplateBody: existingConfig.smsTemplateBody || 'Hi {{name}}, great meeting you at Subset Industries, Stall D44, Paperworld Expo (Hall 6, Bharat Mandapam, Pragati Maidan)! Browse our catalogue: https://drive.google.com/drive/u/4/folders/18udstLL0iFI0tnOV5zwypuuJCs4OjDOK | Queries: sales@subsetpens.com | +91 97271 79186'
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(freshConfig, null, 2));
  console.log('Config initialised with Brevo SMTP credentials.');
};

initDB();

const getLeads = () => JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
const saveLeads = (leads) => fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
const getConfig = () => JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const saveConfig = (config) => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
const getLogs = () => JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
const saveLogs = (logs) => fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));

const addLog = (type, recipient, status, message, error = null) => {
  const logs = getLogs();
  const newLog = {
    id: '_' + Math.random().toString(36).substr(2, 9),
    type, 
    recipient,
    status, 
    message,
    error: error ? error.message || String(error) : null,
    timestamp: new Date().toISOString()
  };
  logs.unshift(newLog); 
  saveLogs(logs.slice(0, 500)); 
  return newLog;
};

const buildHtmlEmail = (lead, bodyText, catalogueUrl) => {
  const lines = bodyText.split('\n').filter(l => l.trim());
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Subset Industries – Paperworld Expo</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:'Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:28px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header — clean company name, spam-safe -->
        <tr>
          <td style="background:#111111;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 6px;color:#e11d48;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">EST. JUNE 2024</p>
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
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
              Dear <strong>${lead.name}</strong>,
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
                  <a href="${catalogueUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
                    View Our Product Catalogue →
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
            <p style="margin:0 0 4px;color:#666;font-size:12px;">Subset Industries Pvt. Ltd. · www.subsetindustries.com</p>
            <p style="margin:0;color:#555;font-size:11px;">You are receiving this because you registered at our expo booth. For queries: sales@subsetpens.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const sendEmailNotification = async (lead, config) => {
  const smtpHost = process.env.SMTP_HOST || config.smtpHost;
  const smtpPort = process.env.SMTP_PORT || config.smtpPort;
  const smtpSecure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE : config.smtpSecure;
  const smtpUser = process.env.SMTP_USER || config.smtpUser;
  const rawPass = process.env.SMTP_PASS || config.smtpPass;
  const smtpSender = process.env.SMTP_SENDER || config.smtpSender;
  const { emailTemplateSubject, catalogueUrl } = config;
  
  if (!smtpHost || !smtpUser || !rawPass) {
    addLog('email', lead.email, 'failed', 'SMTP credentials are not configured.');
    return { success: false, error: 'SMTP not configured' };
  }

  // Use plain text if env var or not encrypted, else decrypt
  const decryptedPass = (process.env.SMTP_PASS || !rawPass.includes(':')) ? rawPass : decrypt(rawPass);

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpSecure === 'true' || smtpSecure === true,
      auth: {
        user: smtpUser,
        pass: decryptedPass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const subject = (emailTemplateSubject || 'Welcome to Subset Industries!')
      .replace(/{{name}}/g, lead.name)
      .replace(/{{company}}/g, lead.company);

    const resolvedCatalogueUrl = catalogueUrl || 'https://www.subsetindustries.com';
    const htmlBody = buildHtmlEmail(lead, '', resolvedCatalogueUrl);

    // Plain-text fallback
    const plainText = `Hi ${lead.name},\n\nThank you for visiting Subset Industries at Paperworld Expo (Stall D44, Hall No. 6, Bharat Mandapam, Pragati Maidan — 30 Jul to 1 Aug 2025)!\n\nFounded in June 2024, Subset Industries is led by a founder with 35+ years of experience in the pen manufacturing industry. We specialise in ball pens, metal pens, roller pens, diary gift sets, and corporate gifting solutions — delivered Pan India.\n\nView our product catalogue: ${resolvedCatalogueUrl}\n\nFor enquiries:\nEmail: sales@subsetpens.com\nPhone / WhatsApp: +91 97271 79186\nWebsite: www.subsetindustries.com\nInstagram: @subsetindustries\nFacebook: Subset Industries Pvt. Ltd.\nLinkedIn: Subset Industries\n\nThis mail is for outreach purposes only.\n\nWarm regards,\nSubset Industries Pvt. Ltd.`;

    const mailOptions = {
      from: smtpSender || 'Subset Industries Pvt. Ltd. <sipl.connect@gmail.com>',
      replyTo: 'sales@subsetpens.com',
      to: lead.email,
      subject: subject,
      // No text: property — HTML-only prevents plain-text from showing above template
      html: htmlBody,
      headers: {
        'List-Unsubscribe': '<mailto:sales@subsetpens.com?subject=Unsubscribe>',
        'X-Mailer': 'Subset Industries Expo System',
        'Precedence': 'bulk',
        'X-Entity-Ref-ID': lead.id || Date.now().toString(),
      }
    };

    const info = await transporter.sendMail(mailOptions);
    addLog('email', lead.email, 'success', `Email sent successfully via ${smtpHost}. MessageID: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    console.error('SMTP Email Error:', error);
    addLog('email', lead.email, 'failed', `Failed to send email: ${error.message}`, error);
    return { success: false, error: error.message };
  }
};

const sendSMSNotification = async (lead, config) => {
  const { smsGateway, twilioSid, twilioAuthToken, twilioNumber, fast2smsKey, smsTemplateBody } = config;

  // Clean phone — strip spaces/dashes, keep digits only for Fast2SMS
  const rawPhone  = lead.phone.replace(/\s|-/g, '');
  const indPhone  = rawPhone.replace(/^\+91/, '').replace(/^\+/, '');
  const messageText = (smsTemplateBody || 'Hi {{name}}, great meeting you at Subset Industries, Stall D44, Paperworld Expo! View our catalogue: https://drive.google.com/drive/u/4/folders/18udstLL0iFI0tnOV5zwypuuJCs4OjDOK')
    .replace(/{{name}}/g, lead.name)
    .replace(/{{company}}/g, lead.company);

  /* ── Fast2SMS ── */
  if (smsGateway === 'fast2sms') {
    if (!fast2smsKey) {
      addLog('sms', lead.phone, 'failed', 'Fast2SMS API key not configured.');
      return { success: false, error: 'Fast2SMS key missing' };
    }
    try {
      const res  = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: decrypt(fast2smsKey),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route:   'q',          // Quick route — no DLT needed
          message: messageText,
          numbers: indPhone,
          flash:   '0'
        })
      });
      const data = await res.json();
      if (!data.return) throw new Error(data.message || 'Fast2SMS error');
      addLog('sms', lead.phone, 'success', `SMS sent via Fast2SMS to ${lead.phone}. Request ID: ${data.request_id}`);
      return { success: true };
    } catch (err) {
      console.error('Fast2SMS error:', err);
      addLog('sms', lead.phone, 'failed', `Fast2SMS failed: ${err.message}`, err);
      return { success: false, error: err.message };
    }
  }

  /* ── Twilio ── */
  if (smsGateway === 'twilio') {
    if (!twilioSid || !twilioAuthToken || !twilioNumber) {
      addLog('sms', lead.phone, 'failed', '[Simulated – Missing Twilio config]');
      return { success: true, mock: true };
    }
    try {
      const client  = twilio(twilioSid, decrypt(twilioAuthToken));
      const message = await client.messages.create({ body: messageText, from: twilioNumber, to: lead.phone });
      addLog('sms', lead.phone, 'success', `SMS sent via Twilio. SID: ${message.sid}`);
      return { success: true };
    } catch (err) {
      console.error('Twilio error:', err);
      addLog('sms', lead.phone, 'failed', `Twilio failed: ${err.message}`, err);
      return { success: false, error: err.message };
    }
  }

  /* ── Mock / fallback ── */
  addLog('sms', lead.phone, 'success', `[Simulated] SMS to ${lead.phone}: "${messageText.substring(0, 80)}..."`);
  return { success: true, mock: true };
};

// Daily Summary Email Logic
const sendDailySummaryEmail = async () => {
  const config = getConfig();
  const leads = getLeads();

  const smtpHost = process.env.SMTP_HOST || config.smtpHost;
  const smtpPort = process.env.SMTP_PORT || config.smtpPort;
  const smtpSecure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE : config.smtpSecure;
  const smtpUser = process.env.SMTP_USER || config.smtpUser;
  const rawPass = process.env.SMTP_PASS || config.smtpPass;
  const smtpSender = process.env.SMTP_SENDER || config.smtpSender;

  if (!smtpHost || !smtpUser || !rawPass) {
    console.log('Daily summary: SMTP credentials not configured.');
    return { success: false, error: 'SMTP not configured' };
  }

  // Format leads as CSV
  let csv = 'Name,Phone,Email,Company,Date\\n';
  leads.forEach(l => {
    const name = (l.name || '').replace(/"/g, '""');
    const phone = (l.phone || '').replace(/"/g, '""');
    const email = (l.email || '').replace(/"/g, '""');
    const company = (l.company || '').replace(/"/g, '""');
    const date = l.timestamp || '';
    csv += `"${name}","${phone}","${email}","${company}","${date}"\\n`;
  });

  const decryptedPass = (process.env.SMTP_PASS || !rawPass.includes(':')) ? rawPass : decrypt(rawPass);
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: smtpSecure === 'true' || smtpSecure === true,
    auth: {
      user: smtpUser,
      pass: decryptedPass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: config.smtpSender || 'Subset Industries Pvt. Ltd. <sipl.connect@gmail.com>',
    to: 'sales@subsetpens.com',
    subject: `Subset Industries - Daily Expo Lead Report (${new Date().toLocaleDateString('en-IN')})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #e11d48; margin-top: 0;">Daily Lead Report</h2>
        <p>Hello Subset Team,</p>
        <p>Please find attached the CSV report containing all leads registered at the Paperworld Expo as of today, <strong>${new Date().toLocaleDateString('en-IN')}</strong>.</p>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 8px;"><strong>Total Leads Collected:</strong> ${leads.length}</p>
        </div>
        <p>This is an automated report sent at the end of the day.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #888; font-size: 12px; margin: 0;">Subset Industries Pvt. Ltd. · Expo Lead Tracking System</p>
      </div>
    `,
    attachments: [
      {
        filename: `subset_leads_${new Date().toISOString().split('T')[0]}.csv`,
        content: csv
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Daily summary report emailed successfully to sales@subsetpens.com');
    return { success: true };
  } catch (err) {
    console.error('Failed to send daily summary email:', err);
    return { success: false, error: err.message };
  }
};

// Scheduler — Check every 10 minutes to send daily summary at 8:00 PM (20:00)
setInterval(() => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const config = getConfig();

  if (now.getHours() === 20 && config.lastDailySummarySentDate !== todayStr) {
    config.lastDailySummarySentDate = todayStr;
    saveConfig(config);
    sendDailySummaryEmail();
  }
}, 10 * 60 * 1000);

// API Endpoints
app.get('/api/config', (req, res) => {
  const config = getConfig();
  const safeConfig = { ...config };
  if (safeConfig.smtpPass) safeConfig.smtpPass = '********';
  if (safeConfig.twilioAuthToken) safeConfig.twilioAuthToken = '********';
  res.json(safeConfig);
});

app.post('/api/trigger-daily-summary', async (req, res) => {
  const result = await sendDailySummaryEmail();
  if (result.success) {
    res.json({ message: 'Daily summary report emailed successfully to sales@subsetpens.com' });
  } else {
    res.status(500).json({ error: 'Failed to send daily summary email', details: result.error });
  }
});

app.post('/api/config', (req, res) => {
  const currentConfig = getConfig();
  const newConfig = req.body;

  if (newConfig.smtpPass === '********') {
    newConfig.smtpPass = currentConfig.smtpPass;
  } else {
    newConfig.smtpPass = encrypt(newConfig.smtpPass);
  }
  
  if (newConfig.twilioAuthToken === '********') {
    newConfig.twilioAuthToken = currentConfig.twilioAuthToken;
  } else {
    newConfig.twilioAuthToken = encrypt(newConfig.twilioAuthToken);
  }

  saveConfig(newConfig);
  res.json({ message: 'Settings saved successfully', config: newConfig });
});

app.get('/api/leads', (req, res) => {
  res.json(getLeads());
});

app.post('/api/leads', async (req, res) => {
  const { name, phone, email, company } = req.body;

  if (!name || !phone || !email || !company) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const leads = getLeads();
  const newLead = {
    id: '_' + Math.random().toString(36).substr(2, 9),
    name,
    phone,
    email,
    company,
    timestamp: new Date().toISOString(),
    status: {
      email: 'pending',
      sms: 'pending'
    },
    interactions: []
  };

  leads.unshift(newLead);
  saveLeads(leads);

  const config = getConfig();
  
  res.status(201).json({ 
    message: 'Lead created successfully', 
    leadId: newLead.id,
    redirectUrl: config.catalogueUrl || '/catalogue' 
  });

  (async () => {
    const emailResult = await sendEmailNotification(newLead, config);
    const updatedLeads = getLeads();
    const targetLeadIndex = updatedLeads.findIndex(l => l.id === newLead.id);
    if (targetLeadIndex !== -1) {
      updatedLeads[targetLeadIndex].status.email = emailResult.success ? 'sent' : 'failed';
      saveLeads(updatedLeads);
    }
  })();

  (async () => {
    const smsResult = await sendSMSNotification(newLead, config);
    const updatedLeads = getLeads();
    const targetLeadIndex = updatedLeads.findIndex(l => l.id === newLead.id);
    if (targetLeadIndex !== -1) {
      updatedLeads[targetLeadIndex].status.sms = smsResult.success ? 'sent' : 'failed';
      saveLeads(updatedLeads);
    }
  })();
});

app.post('/api/leads/:id/interaction', (req, res) => {
  const { id } = req.params;
  const { action, details } = req.body;

  const leads = getLeads();
  const leadIndex = leads.findIndex(l => l.id === id);

  if (leadIndex === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  leads[leadIndex].interactions.push({
    action,
    details: details || '',
    timestamp: new Date().toISOString()
  });

  saveLeads(leads);
  res.json({ message: 'Interaction logged successfully' });
});

app.get('/api/logs', (req, res) => {
  res.json(getLogs());
});

app.get('/api/stats', (req, res) => {
  const leads = getLeads();
  const logs = getLogs();
  const totalLeads = leads.length;
  
  let emailSentCount = 0;
  let emailFailedCount = 0;
  let emailPendingCount = 0;
  let smsSentCount = 0;
  let smsFailedCount = 0;
  let smsPendingCount = 0;

  leads.forEach(l => {
    if (l.status.email === 'sent') emailSentCount++;
    else if (l.status.email === 'failed') emailFailedCount++;
    else emailPendingCount++;

    if (l.status.sms === 'sent') smsSentCount++;
    else if (l.status.sms === 'failed') smsFailedCount++;
    else smsPendingCount++;
  });

  let totalInteractions = 0;
  let sampleRequests = 0;
  leads.forEach(l => {
    totalInteractions += l.interactions.length;
    sampleRequests += l.interactions.filter(i => i.action === 'request_sample').length;
  });

  const hourlyChartData = {};
  leads.forEach(l => {
    const date = new Date(l.timestamp);
    const label = `${date.getHours()}:00`;
    hourlyChartData[label] = (hourlyChartData[label] || 0) + 1;
  });

  const timeline = Object.keys(hourlyChartData).map(key => ({
    time: key,
    count: hourlyChartData[key]
  })).slice(-10);

  res.json({
    totalLeads,
    totalInteractions,
    sampleRequests,
    emailStats: { sent: emailSentCount, failed: emailFailedCount, pending: emailPendingCount },
    smsStats: { sent: smsSentCount, failed: smsFailedCount, pending: smsPendingCount },
    timeline,
    recentLogs: logs.slice(0, 10)
  });
});

// Serve static frontend files in production (or if built locally)
const __dirname = path.resolve();
const distPath = path.join(__dirname, '../frontend/dist');
const distPathLocal = path.join(__dirname, 'frontend/dist'); // handles flat directory structures too

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else if (fs.existsSync(distPathLocal)) {
  app.use(express.static(distPathLocal));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPathLocal, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

