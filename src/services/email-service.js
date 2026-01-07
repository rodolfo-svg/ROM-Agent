// ════════════════════════════════════════════════════════════════
// ROM AGENT - EMAIL SERVICE v2.8.0
// ════════════════════════════════════════════════════════════════
// Serviço de envio de emails (SMTP)
// Suporta templates HTML + texto plano
// ════════════════════════════════════════════════════════════════

import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = null;
    this.configured = false;

    // Configurações do SMTP (do .env)
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE !== 'false', // true para 465, false para outros
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || 'IAROM <noreply@iarom.com.br>',
      baseUrl: process.env.PASSWORD_RESET_BASE_URL || 'http://localhost:3000'
    };

    // Verificar se está configurado
    if (this.config.user && this.config.pass) {
      this.init();
    } else {
      console.warn('⚠️ [EMAIL] SMTP não configurado. Emails não serão enviados.');
    }
  }

  /**
   * Inicializa transporter do nodemailer
   */
  init() {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass
        },
        // Opções adicionais
        pool: true, // Usar pool de conexões
        maxConnections: 5,
        maxMessages: 100
      });

      this.configured = true;
      console.log(`✅ [EMAIL] SMTP configurado: ${this.config.host}:${this.config.port}`);
    } catch (error) {
      console.error('❌ [EMAIL] Erro ao configurar SMTP:', error.message);
      this.configured = false;
    }
  }

  /**
   * Verifica conexão SMTP
   */
  async verifyConnection() {
    if (!this.configured) {
      return { success: false, error: 'SMTP não configurado' };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      console.error('❌ [EMAIL] Falha na verificação SMTP:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia email genérico
   *
   * @param {Object} options - Opções de envio
   * @param {string} options.to - Email destinatário
   * @param {string} options.subject - Assunto
   * @param {string} options.text - Corpo em texto plano
   * @param {string} options.html - Corpo em HTML
   * @returns {Promise<Object>} { success: boolean, messageId: string, error: string }
   */
  async sendEmail({ to, subject, text, html }) {
    if (!this.configured) {
      console.warn('⚠️ [EMAIL] SMTP não configurado. Email não enviado:', { to, subject });
      return { success: false, error: 'SMTP não configurado' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject,
        text,
        html
      });

      console.log(`✅ [EMAIL] Enviado para ${to}: ${subject} (${info.messageId})`);

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error(`❌ [EMAIL] Erro ao enviar para ${to}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Email de recuperação de senha
   *
   * @param {string} email - Email do usuário
   * @param {string} name - Nome do usuário
   * @param {string} resetToken - Token de reset
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendPasswordResetEmail(email, name, resetToken) {
    const resetLink = `${this.config.baseUrl}/reset-password?token=${resetToken}`;

    const subject = 'IAROM - Recuperação de Senha';

    const text = `
Olá ${name},

Recebemos uma solicitação de recuperação de senha para sua conta no IAROM.

Para criar uma nova senha, clique no link abaixo (válido por 1 hora):
${resetLink}

Se você não solicitou esta recuperação, ignore este email. Sua senha permanecerá inalterada.

Por segurança:
- Nunca compartilhe este link
- Este link expira em 1 hora
- Ele pode ser usado apenas uma vez

Atenciosamente,
Equipe IAROM
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    .button:hover { background: #5568d3; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Recuperação de Senha</h1>
    </div>
    <div class="content">
      <p>Olá <strong>${name}</strong>,</p>
      <p>Recebemos uma solicitação de recuperação de senha para sua conta no <strong>IAROM</strong>.</p>
      <p>Para criar uma nova senha, clique no botão abaixo:</p>
      <center>
        <a href="${resetLink}" class="button">Redefinir Senha</a>
      </center>
      <p style="color: #666; font-size: 13px;">Ou copie e cole este link no navegador:<br>
      <code>${resetLink}</code></p>
      <div class="warning">
        <strong>⚠️ Atenção:</strong>
        <ul style="margin: 10px 0;">
          <li>Este link expira em <strong>1 hora</strong></li>
          <li>Ele pode ser usado <strong>apenas uma vez</strong></li>
          <li>Se você não solicitou esta recuperação, ignore este email</li>
        </ul>
      </div>
      <p>Atenciosamente,<br><strong>Equipe IAROM</strong></p>
    </div>
    <div class="footer">
      <p>IAROM - Redator de Obras Magistrais<br>Este é um email automático, não responda.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Email de boas-vindas (registro)
   *
   * @param {string} email - Email do usuário
   * @param {string} name - Nome do usuário
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendWelcomeEmail(email, name) {
    const subject = 'Bem-vindo ao IAROM!';

    const text = `
Olá ${name},

Seja bem-vindo ao IAROM - Redator de Obras Magistrais!

Sua conta foi criada com sucesso. Agora você pode:
- Utilizar nossa IA jurídica especializada
- Pesquisar jurisprudência e doutrina
- Redigir peças jurídicas com assistência de IA
- Gerenciar seus projetos e documentos

Para começar, acesse: ${this.config.baseUrl}

Precisa de ajuda? Confira nossa documentação ou entre em contato.

Atenciosamente,
Equipe IAROM
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .features { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .features li { margin: 10px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Bem-vindo ao IAROM!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>${name}</strong>,</p>
      <p>Sua conta foi criada com sucesso! Estamos felizes em tê-lo conosco.</p>
      <div class="features">
        <h3>O que você pode fazer no IAROM:</h3>
        <ul>
          <li>✅ Utilizar nossa IA jurídica especializada</li>
          <li>📚 Pesquisar jurisprudência em tribunais brasileiros</li>
          <li>📖 Buscar doutrina e artigos jurídicos</li>
          <li>✍️ Redigir peças jurídicas com assistência de IA</li>
          <li>📁 Gerenciar seus projetos e documentos</li>
        </ul>
      </div>
      <center>
        <a href="${this.config.baseUrl}" class="button">Começar Agora</a>
      </center>
      <p>Atenciosamente,<br><strong>Equipe IAROM</strong></p>
    </div>
    <div class="footer">
      <p>IAROM - Redator de Obras Magistrais<br>Este é um email automático, não responda.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Email de notificação de senha alterada
   *
   * @param {string} email - Email do usuário
   * @param {string} name - Nome do usuário
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendPasswordChangedEmail(email, name) {
    const subject = 'IAROM - Senha Alterada';

    const text = `
Olá ${name},

Sua senha foi alterada com sucesso em ${new Date().toLocaleString('pt-BR')}.

Se você não realizou esta alteração, entre em contato imediatamente com nossa equipe.

Por segurança, recomendamos:
- Nunca compartilhar sua senha
- Usar senhas fortes e únicas
- Ativar autenticação de dois fatores (quando disponível)

Atenciosamente,
Equipe IAROM
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Senha Alterada</h1>
    </div>
    <div class="content">
      <p>Olá <strong>${name}</strong>,</p>
      <p>Sua senha foi alterada com sucesso em <strong>${new Date().toLocaleString('pt-BR')}</strong>.</p>
      <div class="alert">
        <strong>⚠️ Não foi você?</strong><br>
        Se você não realizou esta alteração, entre em contato imediatamente com nossa equipe.
      </div>
      <p><strong>Dicas de segurança:</strong></p>
      <ul>
        <li>Nunca compartilhe sua senha</li>
        <li>Use senhas fortes e únicas para cada serviço</li>
        <li>Troque sua senha regularmente</li>
      </ul>
      <p>Atenciosamente,<br><strong>Equipe IAROM</strong></p>
    </div>
    <div class="footer">
      <p>IAROM - Redator de Obras Magistrais<br>Este é um email automático, não responda.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Email de notificação de conta bloqueada
   *
   * @param {string} email - Email do usuário
   * @param {string} name - Nome do usuário
   * @param {number} minutes - Minutos até desbloqueio
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendAccountLockedEmail(email, name, minutes) {
    const subject = 'IAROM - Conta Temporariamente Bloqueada';

    const text = `
Olá ${name},

Sua conta foi temporariamente bloqueada devido a múltiplas tentativas de login falhadas.

Tempo de bloqueio: ${minutes} minutos

Se você não reconhece estas tentativas, sua senha pode estar comprometida.
Recomendamos alterar sua senha assim que a conta for desbloqueada.

Precisa de ajuda? Entre em contato com nossa equipe.

Atenciosamente,
Equipe IAROM
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .alert { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔒 Conta Bloqueada</h1>
    </div>
    <div class="content">
      <p>Olá <strong>${name}</strong>,</p>
      <p>Sua conta foi <strong>temporariamente bloqueada</strong> devido a múltiplas tentativas de login falhadas.</p>
      <div class="alert">
        <strong>⏱️ Tempo de bloqueio:</strong> ${minutes} minutos
      </div>
      <p><strong>O que fazer:</strong></p>
      <ul>
        <li>Aguarde ${minutes} minutos para tentar novamente</li>
        <li>Se não foi você, altere sua senha após desbloqueio</li>
        <li>Entre em contato com suporte se precisar de ajuda</li>
      </ul>
      <p>Atenciosamente,<br><strong>Equipe IAROM</strong></p>
    </div>
    <div class="footer">
      <p>IAROM - Redator de Obras Magistrais<br>Este é um email automático, não responda.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Testa envio de email (para configuração)
   */
  async sendTestEmail(toEmail) {
    return this.sendEmail({
      to: toEmail,
      subject: 'IAROM - Teste de Configuração SMTP',
      text: 'Este é um email de teste. Se você recebeu, o SMTP está configurado corretamente!',
      html: '<h1>✅ SMTP Configurado!</h1><p>Este é um email de teste. Se você recebeu, o SMTP está funcionando corretamente.</p>'
    });
  }
}

// Singleton
const emailService = new EmailService();

export default emailService;
