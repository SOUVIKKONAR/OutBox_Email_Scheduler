import nodemailer from 'nodemailer';
import { env } from './env';

let transporter: nodemailer.Transporter;

export async function initEthereal(): Promise<nodemailer.Transporter> {
  // If credentials are provided via env, use them
  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: env.ETHEREAL_USER,
        pass: env.ETHEREAL_PASS,
      },
    });
    console.log('✅ Ethereal SMTP configured with env credentials');
    console.log(`   📧 Ethereal User: ${env.ETHEREAL_USER}`);
    return transporter;
  }

  // Otherwise auto-generate a test account
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  console.log('✅ Ethereal SMTP auto-configured');
  console.log(`   📧 Ethereal User: ${testAccount.user}`);
  console.log(`   🔑 Ethereal Pass: ${testAccount.pass}`);
  console.log('   ⚠️  Add these to your .env to persist across restarts');

  return transporter;
}

export function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    throw new Error('Ethereal transporter not initialized. Call initEthereal() first.');
  }
  return transporter;
}

export async function sendEmail(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string; previewUrl: string | false }> {
  const t = getTransporter();
  const info = await t.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return {
    messageId: info.messageId,
    previewUrl,
  };
}
