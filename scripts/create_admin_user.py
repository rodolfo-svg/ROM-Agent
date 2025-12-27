#!/usr/bin/env python3
"""
Script para criar usuário admin inicial no banco de dados.
Uso: python3 scripts/create_admin_user.py
"""
import sys
import os

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from api.database import SessionLocal
from api import models
from api.auth import get_password_hash


def create_admin_user():
    """Cria usuário admin se não existir"""
    db = SessionLocal()

    try:
        # Verificar se já existe usuário admin
        existing_user = db.query(models.User).filter(
            models.User.username == 'admin'
        ).first()

        if existing_user:
            print("✓ Usuário 'admin' já existe!")
            return

        # Criar novo usuário admin
        admin_user = models.User(
            email='admin@sceap.com',
            username='admin',
            hashed_password=get_password_hash('admin123'),
            is_active=True,
            is_superuser=True
        )

        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print("✓ Usuário admin criado com sucesso!")
        print(f"  Email: {admin_user.email}")
        print(f"  Username: {admin_user.username}")
        print(f"  Password: admin123")
        print("\n⚠️  IMPORTANTE: Altere a senha após o primeiro login!")

    except Exception as e:
        db.rollback()
        print(f"✗ Erro ao criar usuário: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == '__main__':
    create_admin_user()
