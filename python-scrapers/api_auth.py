#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API Backend com Autenticação Segura
Sistema IAROM - Extrator Processual
"""

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import hashlib
import secrets
import os
import sys
import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import sqlite3
import platform
import subprocess

app = Flask(__name__)
CORS(app)

# CRÍTICO: Garantir que stdout não seja bufferizado (logs aparecem imediatamente no Render)
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Configurações
SECRET_KEY = os.getenv('SECRET_KEY', secrets.token_hex(32))
SESSION_TIMEOUT = 4 * 60 * 60  # 4 horas
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

# CRÍTICO: Configurar limite do Flask
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Configuração de armazenamento inteligente
# Se houver disco persistente montado em /var/data, usar; senão, usar /tmp (efêmero)
PERSISTENT_DISK = '/var/data'
if os.path.exists(PERSISTENT_DISK):
    BASE_STORAGE = PERSISTENT_DISK
    print(f"✅ Usando disco persistente: {PERSISTENT_DISK}")
else:
    BASE_STORAGE = '/tmp'
    print(f"⚠️  Disco persistente não encontrado. Usando /tmp (efêmero)")

UPLOAD_FOLDER = os.path.join(BASE_STORAGE, 'extrator_uploads')
EXPORT_FOLDER = os.path.join(BASE_STORAGE, 'extrator_exports')
CACHE_FOLDER = os.path.join(BASE_STORAGE, 'extrator_cache')
BACKUP_FOLDER = os.path.join(BASE_STORAGE, 'extrator_backups')
LOG_FOLDER = os.path.join(BASE_STORAGE, 'extrator_logs')

# Criar pastas
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EXPORT_FOLDER, exist_ok=True)
os.makedirs(CACHE_FOLDER, exist_ok=True)
os.makedirs(BACKUP_FOLDER, exist_ok=True)
os.makedirs(LOG_FOLDER, exist_ok=True)

# ==================== HELPER FUNCTIONS ====================

def get_desktop_path():
    """Retorna o caminho do Desktop baseado no sistema operacional"""
    system = platform.system()
    home = str(Path.home())

    if system == 'Windows':
        # Windows: C:\Users\Username\Desktop
        desktop = os.path.join(home, 'Desktop')
        # Fallback para Área de Trabalho em português
        if not os.path.exists(desktop):
            desktop = os.path.join(home, 'Área de Trabalho')
    elif system == 'Darwin':  # macOS
        # macOS: /Users/username/Desktop
        desktop = os.path.join(home, 'Desktop')
    else:  # Linux
        # Linux: /home/username/Desktop
        desktop = os.path.join(home, 'Desktop')
        # Fallback para Área de Trabalho em português
        if not os.path.exists(desktop):
            desktop = os.path.join(home, 'Área de Trabalho')

    # Se não existir, criar
    if not os.path.exists(desktop):
        os.makedirs(desktop, exist_ok=True)

    return desktop

# ==================== DATABASE ====================

def init_db():
    """Inicializa banco de dados SQLite"""
    conn = sqlite3.connect('extrator.db')
    c = conn.cursor()

    # Tabela de usuários
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')

    # Tabela de sessões
    c.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # Tabela de logs de processamento
    c.execute('''
        CREATE TABLE IF NOT EXISTS processing_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_id INTEGER,
            processo_numero TEXT,
            export_dest TEXT,
            formats TEXT,
            num_movimentos INTEGER,
            num_documentos INTEGER,
            num_prazos INTEGER,
            num_vicios INTEGER,
            num_nulidades INTEGER,
            num_omissoes INTEGER,
            file_size INTEGER,
            processing_time REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (session_id) REFERENCES sessions (id)
        )
    ''')

    # Criar usuário admin padrão se não existir
    admin_hash = hashlib.sha256('admin123'.encode()).hexdigest()
    try:
        c.execute('''
            INSERT INTO users (username, password_hash, email)
            VALUES (?, ?, ?)
        ''', ('admin', admin_hash, 'admin@iarom.com.br'))
    except sqlite3.IntegrityError:
        pass  # Usuário já existe

    conn.commit()
    conn.close()

init_db()

# ==================== ROTAS FRONTEND ====================

@app.route('/')
def index():
    """Serve a página inicial"""
    return send_file('index_seguro.html')

@app.route('/admin')
def admin_panel():
    """Serve o painel administrativo"""
    return send_file('admin_panel.html')

@app.route('/logomarca_iarom_web.png')
def serve_logo():
    """Serve a logo"""
    return send_file('logomarca_iarom_web.png', mimetype='image/png')

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'IAROM Extrator'}), 200

@app.route('/api/diagnostico')
def diagnostico():
    """Endpoint de diagnóstico - verifica se todas as dependências estão funcionando"""
    resultado = {
        'timestamp': datetime.now().isoformat(),
        'status': 'ok',
        'checks': {}
    }

    print("="*80, flush=True)
    print("🔍 DIAGNÓSTICO DO SISTEMA", flush=True)
    print("="*80, flush=True)

    # 1. Verificar pdftotext
    try:
        proc = subprocess.run(['pdftotext', '-v'], capture_output=True, text=True, timeout=5)
        pdftotext_version = proc.stderr.strip() if proc.stderr else proc.stdout.strip()
        resultado['checks']['pdftotext'] = {
            'status': 'ok',
            'version': pdftotext_version,
            'message': 'pdftotext disponível'
        }
        print(f"✅ pdftotext: {pdftotext_version}", flush=True)
    except FileNotFoundError:
        resultado['checks']['pdftotext'] = {
            'status': 'error',
            'message': 'pdftotext não encontrado - poppler-utils não instalado!'
        }
        resultado['status'] = 'error'
        print("❌ pdftotext: NÃO ENCONTRADO", flush=True)
    except Exception as e:
        resultado['checks']['pdftotext'] = {
            'status': 'error',
            'message': f'Erro ao verificar pdftotext: {str(e)}'
        }
        resultado['status'] = 'error'
        print(f"❌ pdftotext: ERRO - {e}", flush=True)

    # 2. Verificar importação do extrator
    try:
        from extrator_avancado import ExtratorProcessualAvancado
        resultado['checks']['extrator_import'] = {
            'status': 'ok',
            'message': 'ExtratorProcessualAvancado importado com sucesso'
        }
        print("✅ ExtratorProcessualAvancado: importado", flush=True)
    except Exception as e:
        resultado['checks']['extrator_import'] = {
            'status': 'error',
            'message': f'Erro ao importar ExtratorProcessualAvancado: {str(e)}'
        }
        resultado['status'] = 'error'
        print(f"❌ ExtratorProcessualAvancado: ERRO - {e}", flush=True)
        import traceback
        traceback.print_exc()

    # 3. Verificar pastas de trabalho
    pastas = {
        'UPLOAD_FOLDER': UPLOAD_FOLDER,
        'EXPORT_FOLDER': EXPORT_FOLDER,
        'CACHE_FOLDER': CACHE_FOLDER
    }

    pastas_ok = True
    for nome, caminho in pastas.items():
        exists = os.path.exists(caminho)
        writable = os.access(caminho, os.W_OK) if exists else False

        if exists and writable:
            print(f"✅ {nome}: {caminho} (OK)", flush=True)
        else:
            print(f"❌ {nome}: {caminho} (existe={exists}, gravável={writable})", flush=True)
            pastas_ok = False

    resultado['checks']['pastas'] = {
        'status': 'ok' if pastas_ok else 'error',
        'detalhes': pastas
    }

    # 4. Informações do sistema
    resultado['sistema'] = {
        'platform': platform.system(),
        'python_version': platform.python_version(),
        'cwd': os.getcwd(),
        'base_storage': BASE_STORAGE
    }

    # 5. Status das integrações externas
    resultado['integracoes'] = {
        'datajud': datajud_habilitado,
        'jusbrasil': jusbrasil_habilitado,
        'certidoes_dje': certidoes_habilitado,
        'cnj_certidoes_api': cnj_certidoes_api_habilitado
    }

    print("="*80, flush=True)
    print(f"📊 Status geral: {resultado['status'].upper()}", flush=True)
    print("="*80, flush=True)

    status_code = 200 if resultado['status'] == 'ok' else 500
    return jsonify(resultado), status_code

# ==================== AUTENTICAÇÃO ====================

def hash_password(password):
    """Hash SHA-256 da senha"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_token(token):
    """Verifica se o token é válido"""
    conn = sqlite3.connect('extrator.db')
    c = conn.cursor()

    c.execute('''
        SELECT s.id, s.user_id, u.username, s.expires_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND u.is_active = 1
    ''', (token,))

    result = c.fetchone()
    conn.close()

    if not result:
        return None

    session_id, user_id, username, expires_at = result
    expires_datetime = datetime.fromisoformat(expires_at)

    if datetime.now() > expires_datetime:
        # Sessão expirada
        delete_session(token)
        return None

    return {
        'session_id': session_id,
        'user_id': user_id,
        'username': username
    }

def delete_session(token):
    """Remove sessão do banco"""
    conn = sqlite3.connect('extrator.db')
    c = conn.cursor()
    c.execute('DELETE FROM sessions WHERE token = ?', (token,))
    conn.commit()
    conn.close()

# ==================== ENDPOINTS ====================

@app.route('/api/setup', methods=['POST'])
def setup():
    """Endpoint de setup inicial - cria usuário admin se não existir"""
    try:
        data = request.json
        username = data.get('username', 'admin')
        password = data.get('password', 'Admin@2025')
        email = data.get('email', 'admin@iarom.com.br')

        password_hash = hash_password(password)

        conn = sqlite3.connect('extrator.db')
        c = conn.cursor()

        # Verificar se já existe algum usuário
        c.execute('SELECT COUNT(*) FROM users')
        count = c.fetchone()[0]

        if count > 0:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Setup já foi realizado. Use /api/auth/login'
            }), 400

        # Criar usuário admin
        c.execute('''
            INSERT INTO users (username, password_hash, email)
            VALUES (?, ?, ?)
        ''', (username, password_hash, email))

        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'Usuário {username} criado com sucesso!',
            'username': username
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Endpoint de login"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'success': False, 'error': 'Credenciais inválidas'}), 400

        # Verificar usuário
        password_hash = hash_password(password)

        conn = sqlite3.connect('extrator.db')
        c = conn.cursor()

        c.execute('''
            SELECT id, username, email
            FROM users
            WHERE username = ? AND password_hash = ? AND is_active = 1
        ''', (username, password_hash))

        user = c.fetchone()

        if not user:
            conn.close()
            return jsonify({'success': False, 'error': 'Usuário ou senha inválidos'}), 401

        user_id, username, email = user

        # Criar sessão
        token = secrets.token_hex(32)
        expires_at = datetime.now() + timedelta(seconds=SESSION_TIMEOUT)
        ip_address = request.remote_addr
        user_agent = request.headers.get('User-Agent', '')

        c.execute('''
            INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, token, expires_at, ip_address, user_agent))

        # Atualizar last_login
        c.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', (user_id,))

        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'token': token,
            'username': username,
            'email': email,
            'expires_at': expires_at.isoformat()
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Endpoint de logout"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')

        if not token:
            return jsonify({'success': False, 'error': 'Token não fornecido'}), 400

        delete_session(token)

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/auth/verify', methods=['GET'])
def verify():
    """Verifica se o token ainda é válido"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')

        if not token:
            return jsonify({'success': False, 'error': 'Token não fornecido'}), 400

        session_data = verify_token(token)

        if not session_data:
            return jsonify({'success': False, 'error': 'Sessão inválida ou expirada'}), 401

        return jsonify({
            'success': True,
            'username': session_data['username']
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== PROCESSAMENTO ====================

@app.route('/api/extrator/analisar', methods=['POST'])
def analisar_processo():
    """Endpoint principal de análise"""
    try:
        # Verificar autenticação
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        session_data = verify_token(token)

        if not session_data:
            return jsonify({'success': False, 'error': 'Não autenticado'}), 401

        # Obter arquivos e configurações
        files = request.files.getlist('files')  # Corrigido de 'pdfs' para 'files'
        export_dest = request.form.get('export_dest', 'claude-kb')
        custom_path = request.form.get('custom_path', '')

        # NOVO: Opção de otimização para Claude.ai
        otimizar_para_claude = request.form.get('otimizar_claude', 'false').lower() == 'true'

        # NOVO: Resumo Executivo Denso
        criar_resumo_denso = request.form.get('criar_resumo_denso', 'false').lower() == 'true'
        cliente = request.form.get('cliente', '').strip()
        finalidade = request.form.get('finalidade', '').strip()
        pedidos_especificos = request.form.get('pedidos_especificos', '').strip()

        # Tentar ler formats, se não conseguir, usar padrão
        try:
            formats = json.loads(request.form.get('formats', '["txt", "zip"]'))
        except:
            formats = ['txt', 'zip']

        if not files or len(files) == 0:
            print(f"❌ Nenhum arquivo recebido. Campos no request: {list(request.files.keys())}", flush=True)
            return jsonify({'success': False, 'error': 'Nenhum arquivo enviado'}), 400

        print(f"✅ Recebidos {len(files)} arquivo(s) para processar", flush=True)

        # Validar tamanho dos arquivos (aceita qualquer extensão)
        for file in files:
            file.seek(0, os.SEEK_END)
            size = file.tell()
            file.seek(0)

            if size > MAX_FILE_SIZE:
                return jsonify({'success': False, 'error': f'Arquivo {file.filename} excede o tamanho máximo de {MAX_FILE_SIZE / (1024*1024)}MB'}), 400

            print(f"  📄 {file.filename} ({size / (1024*1024):.2f} MB)", flush=True)

        # Criar pasta de trabalho
        session_id = secrets.token_hex(16)
        work_dir = os.path.join(UPLOAD_FOLDER, session_id)
        os.makedirs(work_dir, exist_ok=True)

        # Salvar arquivos
        pdf_paths = []
        total_size = 0
        for file in files:
            path = os.path.join(work_dir, file.filename)
            file.save(path)
            pdf_paths.append(path)
            total_size += os.path.getsize(path)

        # Processar (importar e usar o extrator avançado com 50 ferramentas)
        print(f"🔧 Iniciando processamento com 50 ferramentas...", flush=True)
        from extrator_avancado import ExtratorProcessualAvancado

        start_time = datetime.now()

        try:
            print(f"📌 Instanciando ExtratorProcessualAvancado...", flush=True)
            print(f"   Modo otimização Claude.ai: {'ATIVADO ✨' if otimizar_para_claude else 'DESATIVADO'}", flush=True)
            print(f"   Resumo Executivo Denso: {'ATIVADO 📊' if criar_resumo_denso else 'DESATIVADO'}", flush=True)
            if criar_resumo_denso:
                print(f"   Cliente: {cliente if cliente else '[Não informado]'}", flush=True)
                print(f"   Finalidade: {finalidade if finalidade else '[Não informada]'}", flush=True)
                if pedidos_especificos:
                    print(f"   Pedidos Específicos: {pedidos_especificos[:100]}...", flush=True)

            extrator = ExtratorProcessualAvancado(
                otimizar_para_claude=otimizar_para_claude,
                criar_resumo_denso=criar_resumo_denso,
                cliente=cliente,
                finalidade=finalidade,
                pedidos_especificos=pedidos_especificos
            )
            print(f"✅ Extrator instanciado com sucesso!", flush=True)

            print(f"📂 Configurando processo na pasta: {work_dir}", flush=True)
            extrator.configurar_processo(work_dir)
            print(f"✅ Processo configurado!", flush=True)

            print(f"⚙️ Executando extração completa...", flush=True)
            resultado = extrator.executar_extracao_completa()
            print(f"✅ Extração concluída!", flush=True)

            # Compactar conforme destino
            print(f"📦 Compactando arquivos...", flush=True)
            if export_dest == 'claude-kb':
                zip_path = extrator.compactar_para_claude_ai()
            else:
                zip_path = extrator.compactar_para_claude_ai()  # Usar mesmo método por ora

            print(f"✅ ZIP criado em: {zip_path}", flush=True)

            # Verificar se ZIP foi criado
            if not os.path.exists(zip_path):
                raise Exception(f"ZIP não foi criado: {zip_path}")

            # Mover para pasta de exports
            export_path = os.path.join(EXPORT_FOLDER, session_id)
            os.makedirs(export_path, exist_ok=True)
            final_zip = os.path.join(export_path, 'analise_completa.zip')

            print(f"📤 Movendo ZIP para: {final_zip}", flush=True)
            shutil.move(zip_path, final_zip)
            print(f"✅ ZIP movido com sucesso!", flush=True)

            # Se custom_path especificado ou export_dest requer salvamento customizado
            if export_dest in ['custom', 'both']:
                # Determinar pasta de destino: usar custom_path ou Desktop como padrão
                target_path = custom_path if custom_path and os.path.isdir(custom_path) else get_desktop_path()

                custom_zip = os.path.join(target_path, f'IAROM_Analise_Completa_{session_id}.zip')
                print(f"💾 Copiando para pasta: {custom_zip}", flush=True)
                shutil.copy(final_zip, custom_zip)
                print(f"✅ Copiado para: {target_path}", flush=True)

                if not custom_path:
                    print(f"ℹ️  Nenhuma pasta customizada especificada, usando Desktop: {target_path}", flush=True)
            elif custom_path and not os.path.isdir(custom_path):
                print(f"⚠️ Pasta customizada não existe: {custom_path}", flush=True)

        except Exception as e:
            print(f"❌ ERRO CRÍTICO no processamento: {str(e)}", flush=True)
            print(f"❌ Tipo do erro: {type(e).__name__}", flush=True)
            import traceback
            print("❌ Traceback completo:", flush=True)
            traceback.print_exc()
            raise

        processing_time = (datetime.now() - start_time).total_seconds()

        # Registrar no banco
        conn = sqlite3.connect('extrator.db')
        c = conn.cursor()

        # Obter estatísticas de vícios
        vicios_stats = resultado.get('vicios', {}).get('resumo', {})
        total_vicios = vicios_stats.get('total_vicios', 0)
        total_nulidades = vicios_stats.get('nulidades', 0)
        total_omissoes = vicios_stats.get('omissoes', 0)

        c.execute('''
            INSERT INTO processing_logs (
                user_id, session_id, processo_numero, export_dest, formats,
                num_movimentos, num_documentos, num_prazos,
                num_vicios, num_nulidades, num_omissoes,
                file_size, processing_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            session_data['user_id'],
            session_data['session_id'],
            extrator.config.get('numero_processo', 'N/A'),
            export_dest,
            json.dumps(formats),
            len(resultado['movimentos']),
            len(resultado['documentos']),
            len(resultado['prazos']),
            total_vicios,
            total_nulidades,
            total_omissoes,
            total_size,
            processing_time
        ))

        conn.commit()
        conn.close()

        # Preparar resposta
        stats = {
            'movimentos': len(resultado.get('movimentos', [])),
            'documentos': len(resultado.get('documentos', [])),
            'prazos': len(resultado.get('prazos', [])),
            'vicios': {
                'total': total_vicios,
                'nulidades': total_nulidades,
                'omissoes': total_omissoes,
                'erro_in_procedendo': vicios_stats.get('erro_in_procedendo', 0),
                'teratologias': vicios_stats.get('teratologias', 0),
                'coisa_julgada': vicios_stats.get('coisa_julgada', 0),
                'pedidos_pendentes': vicios_stats.get('pedidos_pendentes', 0),
                'pecas_pendentes': vicios_stats.get('pecas_pendentes', 0)
            },
            'processing_time': processing_time
        }

        print(f"📊 Estatísticas: {stats}", flush=True)
        print(f"✅ Processamento concluído em {processing_time:.2f}s", flush=True)
        print(f"📥 Download disponível em: /api/download/{session_id}/analise_completa.zip", flush=True)

        response_data = {
            'success': True,
            'session_id': session_id,
            'processo': extrator.config.get('numero_processo', 'N/A'),
            'estatisticas': stats,
            'download_url': f'/api/download/{session_id}/analise_completa.zip',
            'zip_path': final_zip
        }

        print(f"📤 Retornando resposta: {response_data}", flush=True)
        return jsonify(response_data)

    except Exception as e:
        print(f"❌ ERRO FATAL NA API: {str(e)}", flush=True)
        print(f"❌ Tipo: {type(e).__name__}", flush=True)
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/extrator/simples', methods=['POST'])
def extrair_simples():
    """Extração simples - apenas extração de texto sem análises"""
    try:
        # Verificar autenticação
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        session_data = verify_token(token)

        if not session_data:
            return jsonify({'success': False, 'error': 'Não autenticado'}), 401

        # Obter arquivos e configurações
        files = request.files.getlist('files')
        export_dest = request.form.get('export_dest', 'download')
        custom_path = request.form.get('custom_path', '')
        extraction_format = request.form.get('extraction_format', 'compressed')

        # NOVO: Opção de otimização para Claude.ai
        otimizar_para_claude = request.form.get('otimizar_claude', 'false').lower() == 'true'

        # NOVO: Resumo Executivo Denso
        criar_resumo_denso = request.form.get('criar_resumo_denso', 'false').lower() == 'true'
        cliente = request.form.get('cliente', '').strip()
        finalidade = request.form.get('finalidade', '').strip()
        pedidos_especificos = request.form.get('pedidos_especificos', '').strip()

        if not files or len(files) == 0:
            print(f"❌ Nenhum arquivo recebido")
            return jsonify({'success': False, 'error': 'Nenhum arquivo enviado'}), 400

        print(f"✅ Extração simples - Recebidos {len(files)} arquivo(s)")

        # Validar tamanho
        for file in files:
            file.seek(0, os.SEEK_END)
            size = file.tell()
            file.seek(0)

            if size > MAX_FILE_SIZE:
                return jsonify({'success': False, 'error': f'Arquivo {file.filename} excede o tamanho máximo'}), 400

        # Criar pasta de trabalho
        session_id = secrets.token_hex(16)
        work_dir = os.path.join(UPLOAD_FOLDER, session_id)
        os.makedirs(work_dir, exist_ok=True)

        # Salvar arquivos
        saved_files = []
        for file in files:
            path = os.path.join(work_dir, file.filename)
            file.save(path)
            saved_files.append(path)
            print(f"  📄 {file.filename}")

        # Usar o ExtratorProcessualAvancado para extração completa (50 ferramentas)
        print(f"🔧 Iniciando extração com ExtratorProcessualAvancado (50 ferramentas)...")
        print(f"   Modo otimização Claude.ai: {'ATIVADO ✨' if otimizar_para_claude else 'DESATIVADO'}", flush=True)
        print(f"   Resumo Executivo Denso: {'ATIVADO 📊' if criar_resumo_denso else 'DESATIVADO'}", flush=True)
        from extrator_avancado import ExtratorProcessualAvancado

        extrator = ExtratorProcessualAvancado(
            otimizar_para_claude=otimizar_para_claude,
            criar_resumo_denso=criar_resumo_denso,
            cliente=cliente,
            finalidade=finalidade
        )
        extrator.configurar_processo(work_dir)

        print(f"⚙️ Executando extração básica (sem análises)...")

        # Executar apenas extração básica, sem análises avançadas
        # Isso vai gerar:
        # - Processo na íntegra
        # - Documentos separados
        # - Movimentos
        # MAS sem análises de vícios, fichamentos complexos, etc

        resultado = {
            'movimentos': [],
            'documentos': [],
            'prazos': [],
            'vicios': {'resumo': {}}
        }

        try:
            # Executar extração básica
            resultado_temp = extrator.executar_extracao_basica()  # Método básico se existir
            if resultado_temp:
                resultado = resultado_temp
        except AttributeError:
            # Se não tiver método básico, usar o completo mas ignorar as análises pesadas
            print(f"⚠️  Método básico não disponível, usando extração completa...")
            resultado = extrator.executar_extracao_completa()

        print(f"✅ Extração concluída!")

        # Contar documentos extraídos
        extracted_count = len(resultado.get('documentos', []))
        extracted_dir = work_dir  # O extrator já organiza tudo em work_dir

        # Compactar conforme formato escolhido
        print(f"📦 Preparando saída no formato: {extraction_format}")

        export_path = os.path.join(EXPORT_FOLDER, session_id)
        os.makedirs(export_path, exist_ok=True)

        if extraction_format == 'compressed':
            # Usar método de compactação do extrator (já otimizado)
            print(f"📦 Compactando arquivos...")
            zip_path = extrator.compactar_para_claude_ai()

            # Renomear para extracao_simples.zip
            final_zip = os.path.join(export_path, 'extracao_simples.zip')
            shutil.move(zip_path, final_zip)
            final_output = final_zip
            print(f"✅ ZIP criado: {final_zip}")

        else:
            # Copiar toda a estrutura de pastas gerada pelo extrator
            import shutil
            output_folder = os.path.join(export_path, 'extracao_simples')

            # Copiar todo o conteúdo da pasta_saida do extrator (onde ficam os arquivos processados)
            pasta_origem = extrator.pasta_saida
            if not pasta_origem or not os.path.exists(pasta_origem):
                print(f"⚠️  pasta_saida não encontrada, usando work_dir")
                pasta_origem = work_dir

            print(f"📂 Copiando de: {pasta_origem}")
            if os.path.exists(output_folder):
                shutil.rmtree(output_folder)
            shutil.copytree(pasta_origem, output_folder)

            final_output = output_folder
            print(f"✅ Pasta criada: {output_folder}")
            print(f"📊 Total de arquivos: {sum(len(files) for _, _, files in os.walk(output_folder))}")

        # Copiar para pasta customizada ou Desktop (se export_dest requer)
        if export_dest in ['custom', 'both']:
            # Determinar pasta de destino: usar custom_path ou Desktop como padrão
            target_path = custom_path if custom_path and os.path.isdir(custom_path) else get_desktop_path()

            if extraction_format == 'compressed':
                custom_file = os.path.join(target_path, f'IAROM_Extracao_Simples_{session_id}.zip')
                shutil.copy(final_output, custom_file)
                print(f"✅ ZIP copiado para: {custom_file}")
            else:
                custom_folder = os.path.join(target_path, f'IAROM_Extracao_Simples_{session_id}')
                shutil.copytree(final_output, custom_folder)
                print(f"✅ Pasta copiada para: {custom_folder}")

            if not custom_path:
                print(f"ℹ️  Nenhuma pasta customizada especificada, usando Desktop: {target_path}")
        elif custom_path and not os.path.isdir(custom_path):
            print(f"⚠️ Pasta customizada não existe: {custom_path}")

        # Preparar estatísticas
        stats = {
            'movimentos': len(resultado.get('movimentos', [])),
            'documentos': len(resultado.get('documentos', [])),
            'prazos': len(resultado.get('prazos', [])),
            'vicios': {'total': 0}  # Extração simples não analisa vícios
        }

        print(f"📊 Estatísticas: {stats}")
        print(f"✅ Extração simples concluída!")

        response = {
            'success': True,
            'session_id': session_id,
            'estatisticas': stats,
            'download_url': f'/api/download/{session_id}/extracao_simples.zip' if extraction_format == 'compressed' else None,
            'message': f'Extração simples concluída: {stats["documentos"]} documento(s), {stats["movimentos"]} movimento(s)'
        }

        print(f"📤 Retornando: {response}")
        return jsonify(response)

    except Exception as e:
        print(f"❌ Erro na extração simples: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/sceap/processar', methods=['POST'])
def processar_sceap_v4():
    """
    Endpoint SCEAP v4.0 - Sistema Completo de Extração e Análise Processual

    Usa:
    - ExtractorOrchestrator (wrapper sobre extrator_avancado.py)
    - Estrutura de 16 pastas
    - REPU com 18 seções
    - Analyzers (vícios e cálculos)
    - APIs externas (DataJud, JusBrasil, DJE)
    """
    try:
        # Verificar autenticação
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        session_data = verify_token(token)

        if not session_data:
            return jsonify({'success': False, 'error': 'Não autenticado'}), 401

        print("\n" + "="*80, flush=True)
        print("🚀 SCEAP v4.0 - PROCESSAMENTO INICIADO", flush=True)
        print("="*80 + "\n", flush=True)

        # Obter arquivos e configurações
        files = request.files.getlist('files')

        # Opções de processamento
        otimizar_para_claude = request.form.get('otimizar_claude', 'false').lower() == 'true'
        criar_resumo_denso = request.form.get('criar_resumo_denso', 'true').lower() == 'true'
        executar_analise_vicios = request.form.get('analisar_vicios', 'false').lower() == 'true'
        executar_analise_calculos = request.form.get('analisar_calculos', 'false').lower() == 'true'
        consultar_apis = request.form.get('consultar_apis', 'false').lower() == 'true'

        # Informações do cliente
        cliente = request.form.get('cliente', '').strip()
        finalidade = request.form.get('finalidade', '').strip()
        pedidos_especificos = request.form.get('pedidos_especificos', '').strip()
        numero_processo = request.form.get('numero_processo', '').strip()

        if not files or len(files) == 0:
            return jsonify({'success': False, 'error': 'Nenhum arquivo enviado'}), 400

        print(f"✅ Recebidos {len(files)} arquivo(s)", flush=True)
        print(f"   Otimizar Claude: {otimizar_para_claude}", flush=True)
        print(f"   Análise de vícios: {executar_analise_vicios}", flush=True)
        print(f"   Análise de cálculos: {executar_analise_calculos}", flush=True)
        print(f"   Consultar APIs: {consultar_apis}", flush=True)

        # Criar pastas de trabalho
        session_id = secrets.token_hex(16)
        work_dir = Path(UPLOAD_FOLDER) / session_id
        export_dir = Path(EXPORT_FOLDER) / session_id
        work_dir.mkdir(parents=True, exist_ok=True)
        export_dir.mkdir(parents=True, exist_ok=True)

        # Salvar arquivos
        for file in files:
            file_path = work_dir / file.filename
            file.save(str(file_path))
            print(f"  📄 {file.filename}", flush=True)

        # Processar com SCEAP v4.0
        print("\n🔧 Inicializando SCEAP v4.0...", flush=True)

        try:
            from sceap.extractors.orchestrator import ExtractorOrchestrator
            from sceap.analyzers.vicios import AnalisadorVicios
            from sceap.analyzers.calculos import AnalisadorCalculos

            # Criar orchestrator
            orchestrator = ExtractorOrchestrator(
                otimizar_para_claude=otimizar_para_claude,
                criar_resumo_denso=criar_resumo_denso,
                cliente=cliente,
                finalidade=finalidade,
                pedidos_especificos=pedidos_especificos
            )

            print("✅ Orchestrator criado", flush=True)

            # Processar pasta
            resultado = orchestrator.processar_pasta(
                pasta_entrada=work_dir,
                pasta_saida=export_dir,
                numero_processo=numero_processo or None
            )

            print(f"✅ Processamento concluído!", flush=True)
            print(f"   Pasta SCEAP: {resultado['pasta_processo']}", flush=True)

            # Análise de vícios (se solicitado)
            if executar_analise_vicios:
                print("\n🔍 Executando análise de vícios...", flush=True)
                try:
                    analyzer_vicios = AnalisadorVicios()
                    # Aqui seria necessário extrair texto e movimentos do resultado
                    # Por ora, apenas informar que está disponível
                    print("✅ Analisador de vícios disponível", flush=True)
                except Exception as e:
                    print(f"⚠️  Erro na análise de vícios: {e}", flush=True)

            # Análise de cálculos (se solicitado)
            if executar_analise_calculos:
                print("\n🧮 Executando análise de cálculos...", flush=True)
                try:
                    analyzer_calculos = AnalisadorCalculos()
                    print("✅ Analisador de cálculos disponível", flush=True)
                except Exception as e:
                    print(f"⚠️  Erro na análise de cálculos: {e}", flush=True)

            # Consultas de APIs (se solicitado)
            if consultar_apis and numero_processo:
                print("\n🌐 Executando consultas de APIs...", flush=True)
                try:
                    from sceap.api_clients.orchestrator import APIOrchestrator
                    api_orch = APIOrchestrator()
                    # Por ora, apenas informar que está disponível
                    print("✅ Orquestrador de APIs disponível", flush=True)
                except Exception as e:
                    print(f"⚠️  Erro nas consultas de APIs: {e}", flush=True)

            # Compactar resultado
            print("\n📦 Compactando resultado...", flush=True)
            pasta_processo = Path(resultado['pasta_processo'])
            zip_path = export_dir / f"SCEAP_{session_id}.zip"

            shutil.make_archive(
                str(zip_path.with_suffix('')),
                'zip',
                str(pasta_processo.parent),
                str(pasta_processo.name)
            )

            print(f"✅ Arquivo compactado: {zip_path.name}", flush=True)

            # Resposta
            response = {
                'success': True,
                'session_id': session_id,
                'resultado': {
                    'pasta_processo': str(resultado['pasta_processo']),
                    'numero_processo': resultado['numero_processo'],
                    'estrutura': 'SCEAP v4.0 (16 pastas)',
                    'ferramentas': resultado['ferramentas_utilizadas'],
                    'arquivo_zip': zip_path.name
                },
                'download_url': f'/api/download/{session_id}/{zip_path.name}',
                'timestamp': datetime.now().isoformat()
            }

            print("\n" + "="*80, flush=True)
            print("✅ SCEAP v4.0 - PROCESSAMENTO CONCLUÍDO", flush=True)
            print("="*80 + "\n", flush=True)

            return jsonify(response)

        except ImportError as e:
            print(f"❌ Erro ao importar módulos SCEAP: {e}", flush=True)
            return jsonify({
                'success': False,
                'error': 'Módulos SCEAP v4.0 não disponíveis. Use /api/extrator/analisar'
            }), 500

    except Exception as e:
        print(f"❌ Erro no processamento SCEAP v4.0: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/download/<session_id>/<filename>', methods=['GET'])
def download_file(session_id, filename):
    """Download de arquivo gerado"""
    try:
        # Verificar autenticação
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        session_data = verify_token(token)

        if not session_data:
            return jsonify({'success': False, 'error': 'Não autenticado'}), 401

        file_path = os.path.join(EXPORT_FOLDER, session_id, filename)

        if not os.path.exists(file_path):
            return jsonify({'success': False, 'error': 'Arquivo não encontrado'}), 404

        return send_file(file_path, as_attachment=True)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/limpar/<session_id>', methods=['DELETE'])
def limpar_cache(session_id):
    """Limpa arquivos de uma sessão"""
    try:
        # Verificar autenticação
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        session_data = verify_token(token)

        if not session_data:
            return jsonify({'success': False, 'error': 'Não autenticado'}), 401

        # Limpar pasta de upload
        upload_path = os.path.join(UPLOAD_FOLDER, session_id)
        if os.path.exists(upload_path):
            shutil.rmtree(upload_path)

        # Limpar pasta de export
        export_path = os.path.join(EXPORT_FOLDER, session_id)
        if os.path.exists(export_path):
            shutil.rmtree(export_path)

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ADMINISTRAÇÃO ====================

@app.route('/api/admin/users', methods=['GET', 'POST'])
def manage_users():
    """Lista ou cria usuários (admin only)"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        session_data = verify_token(token)

        if not session_data:
            print(f"❌ Token inválido ou expirado")
            return jsonify({'success': False, 'error': 'Token inválido ou expirado'}), 401

        print(f"✅ Usuário autenticado: {session_data['username']}")

        if session_data['username'] != 'admin':
            print(f"❌ Acesso negado para usuário: {session_data['username']}")
            return jsonify({'success': False, 'error': f'Acesso negado. Apenas admin pode acessar (usuário atual: {session_data["username"]})'}), 403

        # GET - Listar usuários
        if request.method == 'GET':
            conn = sqlite3.connect('extrator.db')
            c = conn.cursor()

            c.execute('''
                SELECT id, username, email, created_at, last_login, is_active
                FROM users
            ''')

            users = []
            for row in c.fetchall():
                users.append({
                    'id': row[0],
                    'username': row[1],
                    'email': row[2],
                    'created_at': row[3],
                    'last_login': row[4],
                    'is_active': bool(row[5])
                })

            conn.close()
            return jsonify({'success': True, 'users': users})

        # POST - Criar usuário
        elif request.method == 'POST':
            data = request.json
            username = data.get('username', '').strip()
            password = data.get('password', '').strip()
            email = data.get('email', '').strip()

            # Validações
            if not username or len(username) < 3:
                return jsonify({'success': False, 'error': 'Username deve ter no mínimo 3 caracteres'}), 400

            if not password or len(password) < 6:
                return jsonify({'success': False, 'error': 'Senha deve ter no mínimo 6 caracteres'}), 400

            if email and '@' not in email:
                return jsonify({'success': False, 'error': 'Email inválido'}), 400

            # Verificar se username já existe
            conn = sqlite3.connect('extrator.db')
            c = conn.cursor()

            c.execute('SELECT id FROM users WHERE username = ?', (username,))
            if c.fetchone():
                conn.close()
                return jsonify({'success': False, 'error': f'Username "{username}" já existe'}), 400

            # Criar hash da senha
            password_hash = hash_password(password)

            # Inserir novo usuário
            c.execute('''
                INSERT INTO users (username, password_hash, email)
                VALUES (?, ?, ?)
            ''', (username, password_hash, email))

            user_id = c.lastrowid
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': f'Usuário "{username}" criado com sucesso!',
                'user': {
                    'id': user_id,
                    'username': username,
                    'email': email
                }
            }), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['PATCH', 'DELETE'])
def modify_user(user_id):
    """Modifica ou deleta usuário (admin only)"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        session_data = verify_token(token)

        if not session_data:
            print(f"❌ Token inválido ou expirado (modify_user)")
            return jsonify({'success': False, 'error': 'Token inválido ou expirado'}), 401

        if session_data['username'] != 'admin':
            print(f"❌ Acesso negado para usuário: {session_data['username']} (modify_user)")
            return jsonify({'success': False, 'error': 'Acesso negado'}), 403

        conn = sqlite3.connect('extrator.db')
        c = conn.cursor()

        # PATCH - Atualizar usuário (ativar/desativar)
        if request.method == 'PATCH':
            data = request.json
            is_active = data.get('is_active')

            if is_active is None:
                return jsonify({'success': False, 'error': 'Campo is_active é obrigatório'}), 400

            # Não permitir desativar o admin
            c.execute('SELECT username FROM users WHERE id = ?', (user_id,))
            user = c.fetchone()
            if user and user[0] == 'admin' and not is_active:
                conn.close()
                return jsonify({'success': False, 'error': 'Não é possível desativar o usuário admin'}), 400

            c.execute('UPDATE users SET is_active = ? WHERE id = ?', (int(is_active), user_id))
            conn.commit()
            conn.close()

            return jsonify({'success': True, 'message': f'Usuário {"ativado" if is_active else "desativado"} com sucesso'})

        # DELETE - Deletar usuário
        elif request.method == 'DELETE':
            # Não permitir deletar o admin
            c.execute('SELECT username FROM users WHERE id = ?', (user_id,))
            user = c.fetchone()
            if user and user[0] == 'admin':
                conn.close()
                return jsonify({'success': False, 'error': 'Não é possível deletar o usuário admin'}), 400

            c.execute('DELETE FROM users WHERE id = ?', (user_id,))
            conn.commit()
            conn.close()

            return jsonify({'success': True, 'message': 'Usuário deletado com sucesso'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/users/create', methods=['POST'])
def create_user():
    """Cria novo usuário (admin only)"""
    try:
        # Verificar autenticação admin
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        session_data = verify_token(token)

        if not session_data or session_data['username'] != 'admin':
            return jsonify({'success': False, 'error': 'Acesso negado. Apenas admin pode criar usuários.'}), 403

        # Dados do novo usuário
        data = request.json
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        email = data.get('email', '').strip()

        # Validações
        if not username or len(username) < 3:
            return jsonify({'success': False, 'error': 'Username deve ter no mínimo 3 caracteres'}), 400

        if not password or len(password) < 6:
            return jsonify({'success': False, 'error': 'Senha deve ter no mínimo 6 caracteres'}), 400

        if email and '@' not in email:
            return jsonify({'success': False, 'error': 'Email inválido'}), 400

        # Verificar se username já existe
        conn = sqlite3.connect('extrator.db')
        c = conn.cursor()

        c.execute('SELECT id FROM users WHERE username = ?', (username,))
        if c.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': f'Username "{username}" já existe'}), 400

        # Criar hash da senha
        password_hash = hash_password(password)

        # Inserir novo usuário
        c.execute('''
            INSERT INTO users (username, password_hash, email)
            VALUES (?, ?, ?)
        ''', (username, password_hash, email))

        user_id = c.lastrowid
        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'Usuário "{username}" criado com sucesso!',
            'user': {
                'id': user_id,
                'username': username,
                'email': email
            }
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def delete_user():
    """Deleta usuário (admin only)"""
    try:
        # Verificar autenticação admin
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        session_data = verify_token(token)

        if not session_data or session_data['username'] != 'admin':
            return jsonify({'success': False, 'error': 'Acesso negado'}), 403

        user_id = request.view_args['user_id']

        conn = sqlite3.connect('extrator.db')
        c = conn.cursor()

        # Verificar se usuário existe
        c.execute('SELECT username FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()

        if not user:
            conn.close()
            return jsonify({'success': False, 'error': 'Usuário não encontrado'}), 404

        username = user[0]

        # Não permitir deletar admin
        if username == 'admin':
            conn.close()
            return jsonify({'success': False, 'error': 'Não é possível deletar o usuário admin'}), 400

        # Deletar usuário
        c.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'Usuário "{username}" deletado com sucesso'
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/stats', methods=['GET'])
def get_stats():
    """Estatísticas de uso (admin only)"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        session_data = verify_token(token)

        if not session_data or session_data['username'] != 'admin':
            return jsonify({'success': False, 'error': 'Acesso negado'}), 403

        conn = sqlite3.connect('extrator.db')
        c = conn.cursor()

        # Total de processamentos
        c.execute('SELECT COUNT(*) FROM processing_logs')
        total_processamentos = c.fetchone()[0]

        # Processamentos hoje
        c.execute('''
            SELECT COUNT(*) FROM processing_logs
            WHERE DATE(created_at) = DATE('now')
        ''')
        processamentos_hoje = c.fetchone()[0]

        # Usuários ativos
        c.execute('SELECT COUNT(*) FROM users WHERE is_active = 1')
        usuarios_ativos = c.fetchone()[0]

        # Sessões ativas
        c.execute('''
            SELECT COUNT(*) FROM sessions
            WHERE expires_at > datetime('now')
        ''')
        sessoes_ativas = c.fetchone()[0]

        conn.close()

        return jsonify({
            'success': True,
            'stats': {
                'total_processamentos': total_processamentos,
                'processamentos_hoje': processamentos_hoje,
                'usuarios_ativos': usuarios_ativos,
                'sessoes_ativas': sessoes_ativas
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== INTEGR AÇÕES EXTERNAS ====================

# DataJud CNJ
try:
    from datajud_cnj import DataJudCNJ
    datajud_habilitado = True
except ImportError:
    datajud_habilitado = False
    print("⚠️  Módulo datajud_cnj não encontrado")

# JusBrasil
try:
    from jusbrasil_api import JusBrasilAPI
    jusbrasil_habilitado = True
except ImportError:
    jusbrasil_habilitado = False
    print("⚠️  Módulo jusbrasil_api não encontrado")

# Certidões CNJ (DJEs)
try:
    from certidoes_cnj import CertidoesCNJ
    certidoes_habilitado = True
except ImportError:
    certidoes_habilitado = False
    print("⚠️  Módulo certidoes_cnj não encontrado")

# API Certidões CNJ (Oficial)
try:
    from cnj_certidoes_api import CNJCertidoesAPI
    cnj_certidoes_api_habilitado = True
except ImportError:
    cnj_certidoes_api_habilitado = False
    print("⚠️  Módulo cnj_certidoes_api não encontrado")

@app.route('/api/datajud/processo', methods=['POST'])
def datajud_buscar_processo():
    """Busca processo no DataJud CNJ"""
    if not datajud_habilitado:
        return jsonify({'success': False, 'error': 'Módulo DataJud não disponível'}), 503

    try:
        data = request.get_json()
        numero_processo = data.get('numero_processo')
        tribunal = data.get('tribunal')

        if not numero_processo:
            return jsonify({'success': False, 'error': 'Número do processo é obrigatório'}), 400

        client = DataJudCNJ()
        resultado = client.buscar_processo(numero_processo, tribunal)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/datajud/parte', methods=['POST'])
def datajud_buscar_por_parte():
    """Busca processos por nome da parte no DataJud CNJ"""
    if not datajud_habilitado:
        return jsonify({'success': False, 'error': 'Módulo DataJud não disponível'}), 503

    try:
        data = request.get_json()
        nome_parte = data.get('nome_parte')
        tribunal = data.get('tribunal')
        limite = data.get('limite', 20)

        if not nome_parte:
            return jsonify({'success': False, 'error': 'Nome da parte é obrigatório'}), 400

        client = DataJudCNJ()
        resultado = client.buscar_por_parte(nome_parte, tribunal, limite)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/datajud/documento', methods=['POST'])
def datajud_buscar_por_documento():
    """Busca processos por CPF/CNPJ no DataJud CNJ"""
    if not datajud_habilitado:
        return jsonify({'success': False, 'error': 'Módulo DataJud não disponível'}), 503

    try:
        data = request.get_json()
        documento = data.get('documento')
        tribunal = data.get('tribunal')

        if not documento:
            return jsonify({'success': False, 'error': 'CPF/CNPJ é obrigatório'}), 400

        client = DataJudCNJ()
        resultado = client.buscar_por_documento(documento, tribunal)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/datajud/movimentacoes', methods=['POST'])
def datajud_buscar_movimentacoes():
    """Busca movimentações de um processo no DataJud CNJ"""
    if not datajud_habilitado:
        return jsonify({'success': False, 'error': 'Módulo DataJud não disponível'}), 503

    try:
        data = request.get_json()
        numero_processo = data.get('numero_processo')

        if not numero_processo:
            return jsonify({'success': False, 'error': 'Número do processo é obrigatório'}), 400

        client = DataJudCNJ()
        resultado = client.buscar_movimentacoes(numero_processo)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/jusbrasil/pesquisar', methods=['POST'])
def jusbrasil_pesquisar():
    """Pesquisa jurisprudência no JusBrasil"""
    if not jusbrasil_habilitado:
        return jsonify({'success': False, 'error': 'Módulo JusBrasil não disponível'}), 503

    try:
        data = request.get_json()
        termo = data.get('termo')
        tribunal = data.get('tribunal')
        pagina = data.get('pagina', 1)
        limite = data.get('limite', 10)

        if not termo:
            return jsonify({'success': False, 'error': 'Termo de busca é obrigatório'}), 400

        client = JusBrasilAPI()
        resultado = client.pesquisar_jurisprudencia(termo, tribunal, pagina, limite)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/jusbrasil/status', methods=['GET'])
def jusbrasil_status():
    """Verifica status do login JusBrasil"""
    if not jusbrasil_habilitado:
        return jsonify({'success': False, 'error': 'Módulo JusBrasil não disponível'}), 503

    try:
        client = JusBrasilAPI()
        resultado = client.verificar_login()

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/certidoes/publicacao', methods=['POST'])
def certidoes_buscar_publicacao():
    """Busca publicação no DJE"""
    if not certidoes_habilitado:
        return jsonify({'success': False, 'error': 'Módulo Certidões não disponível'}), 503

    try:
        data = request.get_json()
        numero_processo = data.get('numero_processo')
        tribunal = data.get('tribunal')
        data_inicio = data.get('data_inicio')
        data_fim = data.get('data_fim')

        if not numero_processo or not tribunal:
            return jsonify({'success': False, 'error': 'Número do processo e tribunal são obrigatórios'}), 400

        client = CertidoesCNJ()
        resultado = client.buscar_publicacao(numero_processo, tribunal, data_inicio, data_fim)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/certidoes/despachos', methods=['POST'])
def certidoes_buscar_despachos():
    """Busca despachos e decisões publicadas"""
    if not certidoes_habilitado:
        return jsonify({'success': False, 'error': 'Módulo Certidões não disponível'}), 503

    try:
        data = request.get_json()
        numero_processo = data.get('numero_processo')
        tribunal = data.get('tribunal')
        tipo = data.get('tipo', 'todos')

        if not numero_processo or not tribunal:
            return jsonify({'success': False, 'error': 'Número do processo e tribunal são obrigatórios'}), 400

        client = CertidoesCNJ()
        resultado = client.buscar_despachos_decisoes(numero_processo, tribunal, tipo)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/certidoes/diarios', methods=['GET'])
def certidoes_listar_diarios():
    """Lista diários disponíveis"""
    if not certidoes_habilitado:
        return jsonify({'success': False, 'error': 'Módulo Certidões não disponível'}), 503

    try:
        client = CertidoesCNJ()
        resultado = client.listar_diarios_disponiveis()

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/cnj/certidao/emitir', methods=['POST'])
def cnj_emitir_certidao():
    """Emite certidão via API oficial CNJ"""
    if not cnj_certidoes_api_habilitado:
        return jsonify({'success': False, 'error': 'Módulo CNJ Certidões API não disponível'}), 503

    try:
        data = request.get_json()
        numero_processo = data.get('numero_processo')
        tipo_certidao = data.get('tipo_certidao', 'publicacao')
        formato = data.get('formato', 'pdf')
        ambiente = data.get('ambiente', 'homologacao')

        if not numero_processo:
            return jsonify({'success': False, 'error': 'Número do processo é obrigatório'}), 400

        client = CNJCertidoesAPI(ambiente=ambiente)
        resultado = client.emitir_certidao(numero_processo, tipo_certidao, formato)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/cnj/certidao/buscar', methods=['POST'])
def cnj_buscar_publicacao():
    """Busca publicações via API oficial CNJ"""
    if not cnj_certidoes_api_habilitado:
        return jsonify({'success': False, 'error': 'Módulo CNJ Certidões API não disponível'}), 503

    try:
        data = request.get_json()
        numero_processo = data.get('numero_processo')
        data_inicio = data.get('data_inicio')
        data_fim = data.get('data_fim')
        tribunal = data.get('tribunal')
        ambiente = data.get('ambiente', 'homologacao')

        if not numero_processo:
            return jsonify({'success': False, 'error': 'Número do processo é obrigatório'}), 400

        client = CNJCertidoesAPI(ambiente=ambiente)
        resultado = client.buscar_publicacao(numero_processo, data_inicio, data_fim, tribunal)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/cnj/certidao/autenticar', methods=['POST'])
def cnj_autenticar():
    """Autentica na API CNJ"""
    if not cnj_certidoes_api_habilitado:
        return jsonify({'success': False, 'error': 'Módulo CNJ Certidões API não disponível'}), 503

    try:
        data = request.get_json()
        usuario = data.get('usuario')
        senha = data.get('senha')
        ambiente = data.get('ambiente', 'homologacao')

        if not usuario or not senha:
            return jsonify({'success': False, 'error': 'Usuário e senha são obrigatórios'}), 400

        client = CNJCertidoesAPI(usuario, senha, ambiente)
        resultado = client.autenticar()

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/cnj/certidao/info', methods=['GET'])
def cnj_info():
    """Informações sobre a API CNJ"""
    if not cnj_certidoes_api_habilitado:
        return jsonify({'success': False, 'error': 'Módulo CNJ Certidões API não disponível'}), 503

    try:
        client = CNJCertidoesAPI(ambiente='homologacao')
        resultado = client.obter_info()

        return jsonify(resultado)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== LIMPEZA AUTOMÁTICA ====================

def cleanup_old_files():
    """Limpa arquivos antigos (>24h)"""
    try:
        current_time = datetime.now()

        # Limpar uploads
        for session_dir in os.listdir(UPLOAD_FOLDER):
            path = os.path.join(UPLOAD_FOLDER, session_dir)
            if os.path.isdir(path):
                mtime = datetime.fromtimestamp(os.path.getmtime(path))
                if (current_time - mtime).total_seconds() > 86400:  # 24h
                    shutil.rmtree(path)
                    print(f"Removido: {path}")

        # Limpar exports
        for session_dir in os.listdir(EXPORT_FOLDER):
            path = os.path.join(EXPORT_FOLDER, session_dir)
            if os.path.isdir(path):
                mtime = datetime.fromtimestamp(os.path.getmtime(path))
                if (current_time - mtime).total_seconds() > 86400:  # 24h
                    shutil.rmtree(path)
                    print(f"Removido: {path}")

        # Limpar sessões expiradas do banco
        conn = sqlite3.connect('extrator.db')
        c = conn.cursor()
        c.execute("DELETE FROM sessions WHERE expires_at < datetime('now')")
        deleted = c.rowcount
        conn.commit()
        conn.close()

        print(f"Limpeza concluída: {deleted} sessões expiradas removidas")

    except Exception as e:
        print(f"Erro na limpeza: {e}")

# Executar limpeza a cada hora
import threading
import time

def cleanup_scheduler():
    while True:
        time.sleep(3600)  # 1 hora
        cleanup_old_files()

cleanup_thread = threading.Thread(target=cleanup_scheduler, daemon=True)
cleanup_thread.start()

# ==================== MAIN ====================

if __name__ == '__main__':
    print("="*80)
    print("IAROM - Extrator Processual API")
    print("="*80)
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Export folder: {EXPORT_FOLDER}")
    print(f"Max file size: {MAX_FILE_SIZE / (1024*1024)} MB")
    print(f"Session timeout: {SESSION_TIMEOUT / 3600} hours")
    print("="*80)

    # Pega porta do ambiente (Render) ou usa 5000
    port = int(os.getenv('PORT', 5000))

    # Modo desenvolvimento local
    app.run(host='0.0.0.0', port=port, debug=False)

    # Modo produção (Render usa gunicorn automaticamente via Procfile)
    # gunicorn -w 4 -b 0.0.0.0:$PORT api_auth:app
