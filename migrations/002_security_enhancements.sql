-- ════════════════════════════════════════════════════════════════
-- ROM AGENT - SECURITY ENHANCEMENTS v2.8.0
-- ════════════════════════════════════════════════════════════════
-- MIGRATION 002: Extensões de Segurança
-- Implementa políticas robustas anti-hacker:
-- - Políticas de senha (complexidade, expir, histórico)
-- - Bloqueio de conta após falhas
-- - Audit logging completo
-- - Detecção de força bruta (IP blacklist)
-- - Sessões por dispositivo
-- - Password reset tokens
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- EXTENSÕES DA TABELA USERS - POLÍTICAS DE SENHA
-- ════════════════════════════════════════════════════════════════

-- Contador de tentativas de login falhadas
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;

-- Timestamp até quando a conta está bloqueada
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMPTZ;

-- Quando a senha foi alterada pela última vez
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW();

-- Quando a senha expira (calculado: password_changed_at + PASSWORD_EXPIRY_DAYS)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ;

-- Força usuário a trocar senha no próximo login
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;

-- Comentários
COMMENT ON COLUMN users.failed_login_attempts IS 'Contador de tentativas de login falhadas (reset após sucesso)';
COMMENT ON COLUMN users.account_locked_until IS 'Conta bloqueada até este timestamp (após 5 falhas)';
COMMENT ON COLUMN users.password_changed_at IS 'Data da última troca de senha';
COMMENT ON COLUMN users.password_expires_at IS 'Data de expiração da senha (90 dias após troca)';
COMMENT ON COLUMN users.force_password_change IS 'Forçar troca de senha no próximo login';

-- Índices para performance
CREATE INDEX IF NOT EXISTS users_account_locked_until_idx ON users(account_locked_until)
  WHERE account_locked_until IS NOT NULL;

-- ════════════════════════════════════════════════════════════════
-- TABELA: password_history
-- Armazena histórico de senhas (últimas 5) para impedir reutilização
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_history_user_id_idx ON password_history(user_id);
CREATE INDEX IF NOT EXISTS password_history_created_at_idx ON password_history(created_at DESC);

COMMENT ON TABLE password_history IS 'Histórico de senhas para impedir reutilização das últimas 5';
COMMENT ON COLUMN password_history.user_id IS 'Referência ao usuário';
COMMENT ON COLUMN password_history.password_hash IS 'Hash bcrypt da senha (nunca armazena senha em texto)';

-- ════════════════════════════════════════════════════════════════
-- TABELA: audit_log
-- Log de auditoria de todas ações de segurança críticas
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries comuns de auditoria
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_ip_address_idx ON audit_log(ip_address);
CREATE INDEX IF NOT EXISTS audit_log_status_idx ON audit_log(status);

-- Índice composto para queries por usuário + ação
CREATE INDEX IF NOT EXISTS audit_log_user_action_idx ON audit_log(user_id, action, created_at DESC);

COMMENT ON TABLE audit_log IS 'Log de auditoria completo de todas ações de segurança (retenção: 1 ano)';
COMMENT ON COLUMN audit_log.action IS 'Ação: login, logout, register, password_change, password_reset_request, etc.';
COMMENT ON COLUMN audit_log.resource IS 'Recurso afetado (ex: user_id, document_id)';
COMMENT ON COLUMN audit_log.ip_address IS 'Endereço IP de origem (tipo INET para queries eficientes)';
COMMENT ON COLUMN audit_log.status IS 'success ou failure';
COMMENT ON COLUMN audit_log.details IS 'Detalhes adicionais em JSON (ex: reason, error_code)';

-- ════════════════════════════════════════════════════════════════
-- TABELA: ip_blacklist
-- IPs bloqueados por tentativas de força bruta
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ip_blacklist (
  ip_address INET PRIMARY KEY,
  reason VARCHAR(255),
  blocked_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ip_blacklist_blocked_until_idx ON ip_blacklist(blocked_until);

COMMENT ON TABLE ip_blacklist IS 'IPs bloqueados por detecção de força bruta (auto-expira)';
COMMENT ON COLUMN ip_blacklist.ip_address IS 'Endereço IP bloqueado (tipo INET)';
COMMENT ON COLUMN ip_blacklist.reason IS 'Motivo do bloqueio (ex: "10 falhas em 15 minutos")';
COMMENT ON COLUMN ip_blacklist.blocked_until IS 'Bloqueado até este timestamp (depois libera automaticamente)';

-- ════════════════════════════════════════════════════════════════
-- EXTENSÕES DA TABELA SESSIONS - CONTROLE POR DISPOSITIVO
-- ════════════════════════════════════════════════════════════════

-- Referência ao usuário (para limitar sessões simultâneas)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Fingerprint do dispositivo (gerado no frontend)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255);

-- User-Agent do navegador
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- IP de origem da sessão
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address INET;

-- Índice para queries por usuário (verificar limite de sessões)
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id) WHERE user_id IS NOT NULL;

-- Índice composto para cleanup de sessões expiradas
CREATE INDEX IF NOT EXISTS sessions_expire_user_idx ON sessions(expire, user_id);

COMMENT ON COLUMN sessions.user_id IS 'Usuário dono da sessão (para limitar sessões simultâneas)';
COMMENT ON COLUMN sessions.device_fingerprint IS 'Fingerprint único do dispositivo';
COMMENT ON COLUMN sessions.user_agent IS 'User-Agent do navegador';
COMMENT ON COLUMN sessions.ip_address IS 'IP de origem da sessão';

-- ════════════════════════════════════════════════════════════════
-- TABELA: password_reset_tokens
-- Tokens de recuperação de senha (one-time use, expira em 1 hora)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_token_idx ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens(expires_at);

COMMENT ON TABLE password_reset_tokens IS 'Tokens de recuperação de senha (expira em 1 hora, one-time use)';
COMMENT ON COLUMN password_reset_tokens.token IS 'Token único gerado com crypto.randomBytes(32)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expira após 1 hora';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp quando token foi usado (null = não usado)';

-- ════════════════════════════════════════════════════════════════
-- FUNÇÃO: limpar tokens expirados automaticamente
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cleanup_expired_password_reset_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_password_reset_tokens IS 'Remove tokens expirados (> 7 dias). Executar via CRON diário.';

-- ════════════════════════════════════════════════════════════════
-- FUNÇÃO: limpar IPs desbloqueados da blacklist
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cleanup_expired_ip_blacklist()
RETURNS void AS $$
BEGIN
  DELETE FROM ip_blacklist
  WHERE blocked_until < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_ip_blacklist IS 'Remove IPs cuja data de bloqueio expirou. Executar via CRON a cada hora.';

-- ════════════════════════════════════════════════════════════════
-- FUNÇÃO: limpar audit logs antigos (retenção: 1 ano)
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_log
  WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Remove logs de auditoria com mais de 1 ano. Executar via CRON mensal.';

-- ════════════════════════════════════════════════════════════════
-- VIEW: active_sessions_per_user
-- Útil para verificar limite de sessões simultâneas
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW active_sessions_per_user AS
SELECT
  user_id,
  COUNT(*) as session_count,
  array_agg(sid) as session_ids
FROM sessions
WHERE user_id IS NOT NULL
  AND expire > NOW()
GROUP BY user_id;

COMMENT ON VIEW active_sessions_per_user IS 'Conta sessões ativas por usuário (para limitar a 3)';

-- ════════════════════════════════════════════════════════════════
-- POLICIES PADRÃO - INICIALIZAÇÃO
-- ════════════════════════════════════════════════════════════════

-- Garantir que novos usuários tenham campos de segurança inicializados
-- (Trigger ou aplicar via application-level é mais seguro)

-- ════════════════════════════════════════════════════════════════
-- ESTATÍSTICAS E INFORMAÇÕES
-- ════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'MIGRATION 002 - SECURITY ENHANCEMENTS CONCLUÍDA COM SUCESSO';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '  ✅ password_history';
  RAISE NOTICE '  ✅ audit_log';
  RAISE NOTICE '  ✅ ip_blacklist';
  RAISE NOTICE '  ✅ password_reset_tokens';
  RAISE NOTICE '';
  RAISE NOTICE 'Extensões em users:';
  RAISE NOTICE '  ✅ failed_login_attempts';
  RAISE NOTICE '  ✅ account_locked_until';
  RAISE NOTICE '  ✅ password_changed_at';
  RAISE NOTICE '  ✅ password_expires_at';
  RAISE NOTICE '  ✅ force_password_change';
  RAISE NOTICE '';
  RAISE NOTICE 'Extensões em sessions:';
  RAISE NOTICE '  ✅ user_id';
  RAISE NOTICE '  ✅ device_fingerprint';
  RAISE NOTICE '  ✅ user_agent';
  RAISE NOTICE '  ✅ ip_address';
  RAISE NOTICE '';
  RAISE NOTICE 'Funções de manutenção:';
  RAISE NOTICE '  ✅ cleanup_expired_password_reset_tokens()';
  RAISE NOTICE '  ✅ cleanup_expired_ip_blacklist()';
  RAISE NOTICE '  ✅ cleanup_old_audit_logs()';
  RAISE NOTICE '';
  RAISE NOTICE 'Views:';
  RAISE NOTICE '  ✅ active_sessions_per_user';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASSOS:';
  RAISE NOTICE '  1. Implementar services (audit, password-policy, brute-force)';
  RAISE NOTICE '  2. Implementar middleware (security-headers, csrf, ip-blocker)';
  RAISE NOTICE '  3. Expandir rotas de autenticação';
  RAISE NOTICE '  4. Configurar CRON para funções de limpeza';
  RAISE NOTICE '';
  RAISE NOTICE 'SEGURANÇA:';
  RAISE NOTICE '  🔒 Bloqueio de conta após 5 falhas (30 min)';
  RAISE NOTICE '  🔒 IP blacklist após 10 falhas (1 hora)';
  RAISE NOTICE '  🔒 Senhas expiram em 90 dias';
  RAISE NOTICE '  🔒 Histórico de 5 últimas senhas';
  RAISE NOTICE '  🔒 Máximo 3 sessões simultâneas';
  RAISE NOTICE '  🔒 Audit log completo (retenção: 1 ano)';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;
