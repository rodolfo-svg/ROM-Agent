#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Gerenciamento de Usuários
IAROM - Extrator Processual
"""

import hashlib
import sqlite3
import argparse
import getpass
from datetime import datetime

DB_FILE = 'extrator.db'

def hash_password(password):
    """Hash SHA-256 da senha"""
    return hashlib.sha256(password.encode()).hexdigest()

def add_user(username, password=None, email=''):
    """Adiciona novo usuário"""
    if not password:
        password = getpass.getpass('Senha: ')
        password_confirm = getpass.getpass('Confirme a senha: ')

        if password != password_confirm:
            print("❌ Senhas não conferem!")
            return False

    password_hash = hash_password(password)

    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        c.execute('''
            INSERT INTO users (username, password_hash, email)
            VALUES (?, ?, ?)
        ''', (username, password_hash, email))

        conn.commit()
        conn.close()

        print(f"✅ Usuário '{username}' criado com sucesso!")
        print(f"   Email: {email or 'Não informado'}")
        return True

    except sqlite3.IntegrityError:
        print(f"❌ Usuário '{username}' já existe!")
        return False
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def list_users():
    """Lista todos os usuários"""
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        c.execute('''
            SELECT id, username, email, created_at, last_login, is_active
            FROM users
            ORDER BY created_at DESC
        ''')

        users = c.fetchall()
        conn.close()

        if not users:
            print("Nenhum usuário cadastrado.")
            return

        print("\n" + "="*80)
        print("USUÁRIOS CADASTRADOS")
        print("="*80)
        print(f"{'ID':<5} {'Usuário':<15} {'Email':<25} {'Criado':<20} {'Ativo':<6}")
        print("-"*80)

        for user in users:
            uid, username, email, created, last_login, active = user
            status = "✅ Sim" if active else "❌ Não"
            print(f"{uid:<5} {username:<15} {email or 'N/A':<25} {created:<20} {status:<6}")

        print("="*80 + "\n")

    except Exception as e:
        print(f"❌ Erro: {e}")

def change_password(username, new_password=None):
    """Altera senha de um usuário"""
    if not new_password:
        new_password = getpass.getpass('Nova senha: ')
        password_confirm = getpass.getpass('Confirme a nova senha: ')

        if new_password != password_confirm:
            print("❌ Senhas não conferem!")
            return False

    password_hash = hash_password(new_password)

    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        c.execute('''
            UPDATE users
            SET password_hash = ?
            WHERE username = ?
        ''', (password_hash, username))

        if c.rowcount == 0:
            print(f"❌ Usuário '{username}' não encontrado!")
            conn.close()
            return False

        conn.commit()
        conn.close()

        print(f"✅ Senha do usuário '{username}' alterada com sucesso!")
        return True

    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def deactivate_user(username):
    """Desativa um usuário"""
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        c.execute('''
            UPDATE users
            SET is_active = 0
            WHERE username = ?
        ''', (username,))

        if c.rowcount == 0:
            print(f"❌ Usuário '{username}' não encontrado!")
            conn.close()
            return False

        # Remover todas as sessões ativas
        c.execute('''
            DELETE FROM sessions
            WHERE user_id = (SELECT id FROM users WHERE username = ?)
        ''', (username,))

        conn.commit()
        conn.close()

        print(f"✅ Usuário '{username}' desativado!")
        print(f"   Todas as sessões foram encerradas.")
        return True

    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def activate_user(username):
    """Reativa um usuário"""
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        c.execute('''
            UPDATE users
            SET is_active = 1
            WHERE username = ?
        ''', (username,))

        if c.rowcount == 0:
            print(f"❌ Usuário '{username}' não encontrado!")
            conn.close()
            return False

        conn.commit()
        conn.close()

        print(f"✅ Usuário '{username}' reativado!")
        return True

    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def delete_user(username):
    """Remove um usuário (permanentemente)"""
    confirm = input(f"⚠️  ATENÇÃO: Tem certeza que deseja DELETAR o usuário '{username}'? (sim/não): ")

    if confirm.lower() != 'sim':
        print("Operação cancelada.")
        return False

    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        # Deletar sessões
        c.execute('''
            DELETE FROM sessions
            WHERE user_id = (SELECT id FROM users WHERE username = ?)
        ''', (username,))

        # Deletar logs
        c.execute('''
            DELETE FROM processing_logs
            WHERE user_id = (SELECT id FROM users WHERE username = ?)
        ''', (username,))

        # Deletar usuário
        c.execute('DELETE FROM users WHERE username = ?', (username,))

        if c.rowcount == 0:
            print(f"❌ Usuário '{username}' não encontrado!")
            conn.close()
            return False

        conn.commit()
        conn.close()

        print(f"✅ Usuário '{username}' deletado permanentemente!")
        return True

    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def show_stats():
    """Mostra estatísticas do sistema"""
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        # Total de usuários
        c.execute('SELECT COUNT(*) FROM users')
        total_users = c.fetchone()[0]

        # Usuários ativos
        c.execute('SELECT COUNT(*) FROM users WHERE is_active = 1')
        active_users = c.fetchone()[0]

        # Total de processamentos
        c.execute('SELECT COUNT(*) FROM processing_logs')
        total_processing = c.fetchone()[0]

        # Processamentos hoje
        c.execute('''
            SELECT COUNT(*) FROM processing_logs
            WHERE DATE(created_at) = DATE('now')
        ''')
        today_processing = c.fetchone()[0]

        # Sessões ativas
        c.execute('''
            SELECT COUNT(*) FROM sessions
            WHERE expires_at > datetime('now')
        ''')
        active_sessions = c.fetchone()[0]

        conn.close()

        print("\n" + "="*80)
        print("ESTATÍSTICAS DO SISTEMA")
        print("="*80)
        print(f"Usuários cadastrados: {total_users}")
        print(f"Usuários ativos: {active_users}")
        print(f"Total de processamentos: {total_processing}")
        print(f"Processamentos hoje: {today_processing}")
        print(f"Sessões ativas: {active_sessions}")
        print("="*80 + "\n")

    except Exception as e:
        print(f"❌ Erro: {e}")

def main():
    parser = argparse.ArgumentParser(
        description='Gerenciamento de usuários - IAROM Extrator Processual',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos de uso:

  # Adicionar usuário (interativo)
  python manage_users.py add joao

  # Adicionar usuário (com senha)
  python manage_users.py add maria --password senha123 --email maria@empresa.com

  # Listar usuários
  python manage_users.py list

  # Alterar senha
  python manage_users.py password joao

  # Desativar usuário
  python manage_users.py deactivate maria

  # Reativar usuário
  python manage_users.py activate maria

  # Ver estatísticas
  python manage_users.py stats
        """
    )

    parser.add_argument('action',
                       choices=['add', 'list', 'password', 'deactivate', 'activate', 'delete', 'stats'],
                       help='Ação a ser executada')

    parser.add_argument('username', nargs='?', help='Nome do usuário')
    parser.add_argument('--password', help='Senha (não recomendado em linha de comando)')
    parser.add_argument('--email', help='Email do usuário')

    args = parser.parse_args()

    if args.action == 'add':
        if not args.username:
            print("❌ Erro: username é obrigatório para adicionar usuário")
            return
        add_user(args.username, args.password, args.email or '')

    elif args.action == 'list':
        list_users()

    elif args.action == 'password':
        if not args.username:
            print("❌ Erro: username é obrigatório para alterar senha")
            return
        change_password(args.username, args.password)

    elif args.action == 'deactivate':
        if not args.username:
            print("❌ Erro: username é obrigatório para desativar usuário")
            return
        deactivate_user(args.username)

    elif args.action == 'activate':
        if not args.username:
            print("❌ Erro: username é obrigatório para ativar usuário")
            return
        activate_user(args.username)

    elif args.action == 'delete':
        if not args.username:
            print("❌ Erro: username é obrigatório para deletar usuário")
            return
        delete_user(args.username)

    elif args.action == 'stats':
        show_stats()

if __name__ == '__main__':
    print("="*80)
    print("IAROM - Extrator Processual | Gerenciamento de Usuários")
    print("="*80 + "\n")

    main()
