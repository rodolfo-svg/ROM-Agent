#!/usr/bin/env python3
"""
SCEAP v4.0 - Script de Verificação do Sistema
Verifica integridade, dependências e configurações do SCEAP
"""

import sys
import os
from pathlib import Path
import subprocess


def print_header(text):
    """Imprime cabeçalho formatado"""
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")


def check_python_version():
    """Verifica versão do Python"""
    print_header("VERSÃO DO PYTHON")

    version = sys.version_info
    print(f"Python {version.major}.{version.minor}.{version.micro}")

    if version.major < 3 or (version.major == 3 and version.minor < 9):
        print("❌ ERRO: Python 3.9 ou superior é necessário")
        return False
    else:
        print("✅ Versão OK")
        return True


def check_file_structure():
    """Verifica estrutura de arquivos"""
    print_header("ESTRUTURA DE ARQUIVOS")

    base_dir = Path(__file__).parent
    required_dirs = [
        "sceap",
        "sceap/intake",
        "sceap/ai",
    ]

    required_files = [
        "requirements.txt",
        "sceap/__init__.py",
        "sceap/config.py",
        "sceap/intake/__init__.py",
        "sceap/intake/areas.py",
        "sceap/intake/finalidades.py",
        "sceap/intake/triagem.py",
        "sceap/intake/configurador.py",
        "sceap/ai/__init__.py",
        "sceap/ai/claude_client.py",
        "sceap/ai/resumidor.py",
        "sceap/ai/analisador_teses.py",
        "sceap/ai/gerador_minutas.py",
        "sceap/ai/avaliador_exito.py",
        "sceap/ai/comparador_casos.py",
        "sceap/ai/assistente.py",
    ]

    all_ok = True

    # Verifica diretórios
    for dir_path in required_dirs:
        full_path = base_dir / dir_path
        if full_path.exists():
            print(f"✅ {dir_path}/")
        else:
            print(f"❌ {dir_path}/ NÃO ENCONTRADO")
            all_ok = False

    print()

    # Verifica arquivos
    for file_path in required_files:
        full_path = base_dir / file_path
        if full_path.exists():
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} NÃO ENCONTRADO")
            all_ok = False

    return all_ok


def check_imports():
    """Verifica imports básicos"""
    print_header("VERIFICAÇÃO DE IMPORTS")

    modules_to_test = [
        ("sceap", "Módulo principal"),
        ("sceap.config", "Configurações"),
        ("sceap.intake", "Intake/Triagem"),
        ("sceap.intake.areas", "Áreas do Direito"),
        ("sceap.intake.finalidades", "Finalidades"),
        ("sceap.intake.triagem", "Wizard de Triagem"),
        ("sceap.intake.configurador", "Configurador"),
    ]

    all_ok = True

    for module, description in modules_to_test:
        try:
            __import__(module)
            print(f"✅ {module:30} - {description}")
        except Exception as e:
            print(f"❌ {module:30} - ERRO: {str(e)[:50]}")
            all_ok = False

    return all_ok


def check_ai_module():
    """Verifica módulo AI (pode falhar se anthropic não instalado)"""
    print_header("VERIFICAÇÃO DO MÓDULO AI")

    try:
        import anthropic
        print("✅ Biblioteca anthropic instalada")
        api_key_ok = True
    except ImportError:
        print("⚠️  Biblioteca anthropic não instalada")
        print("   Instale com: pip install anthropic>=0.18.0")
        api_key_ok = False

    # Verifica API key
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if api_key:
        print(f"✅ ANTHROPIC_API_KEY definida ({api_key[:8]}...)")
    else:
        print("⚠️  ANTHROPIC_API_KEY não definida")
        print("   Módulo AI não funcionará sem a chave")
        api_key_ok = False

    # Tenta importar módulos AI
    if api_key_ok:
        ai_modules = [
            "sceap.ai.claude_client",
            "sceap.ai.resumidor",
            "sceap.ai.analisador_teses",
            "sceap.ai.gerador_minutas",
            "sceap.ai.avaliador_exito",
            "sceap.ai.comparador_casos",
            "sceap.ai.assistente",
        ]

        print("\nMódulos AI:")
        for module in ai_modules:
            try:
                __import__(module)
                print(f"  ✅ {module}")
            except Exception as e:
                print(f"  ❌ {module}: {str(e)[:50]}")

    return api_key_ok


def count_statistics():
    """Conta estatísticas do projeto"""
    print_header("ESTATÍSTICAS DO PROJETO")

    base_dir = Path(__file__).parent / "sceap"

    # Conta arquivos Python
    py_files = list(base_dir.rglob("*.py"))
    print(f"Arquivos Python: {len(py_files)}")

    # Conta linhas de código
    total_lines = 0
    for file in py_files:
        try:
            with open(file, 'r', encoding='utf-8') as f:
                total_lines += len(f.readlines())
        except:
            pass

    print(f"Linhas de código: {total_lines:,}")

    # Estatísticas por módulo
    print("\nArquivos por módulo:")
    modules = {}
    for file in py_files:
        parts = file.relative_to(base_dir).parts
        if len(parts) > 0:
            module = parts[0] if len(parts) > 1 else "root"
            modules[module] = modules.get(module, 0) + 1

    for module in sorted(modules.keys()):
        print(f"  {module:20} {modules[module]:3} arquivos")


def check_configuration():
    """Verifica configurações do sistema"""
    print_header("VERIFICAÇÃO DE CONFIGURAÇÕES")

    try:
        from sceap import config

        print(f"Versão: {config.VERSAO_SCEAP}")
        print(f"Data: {config.VERSAO_DATA}")
        print(f"Nome: {config.NOME_SISTEMA}")
        print(f"\nÁreas do Direito: {len(config.AREAS_DIREITO)}")
        print(f"Total de Finalidades: {config.TOTAL_FINALIDADES}")

        # Verifica configurações
        checks = config.verificar_configuracao()
        print("\nVerificações:")
        for check, status in checks.items():
            icon = "✅" if status else "❌"
            print(f"  {icon} {check}")

        return all(checks.values())

    except Exception as e:
        print(f"❌ Erro ao carregar configurações: {e}")
        return False


def main():
    """Executa todas as verificações"""
    print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           SCEAP v4.0 - VERIFICAÇÃO DO SISTEMA                ║
║   Sistema Completo de Extração e Análise Processual         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
""")

    results = {
        "Python Version": check_python_version(),
        "File Structure": check_file_structure(),
        "Basic Imports": check_imports(),
        "AI Module": check_ai_module(),
        "Configuration": check_configuration(),
    }

    count_statistics()

    # Resumo final
    print_header("RESUMO FINAL")

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for check, status in results.items():
        icon = "✅" if status else "❌"
        print(f"{icon} {check}")

    print(f"\nResultado: {passed}/{total} verificações passaram")

    if passed == total:
        print("\n✅ SISTEMA SCEAP v4.0 - TOTALMENTE FUNCIONAL\n")
        return 0
    elif passed >= total - 1:
        print("\n⚠️  SISTEMA SCEAP v4.0 - FUNCIONANDO COM AVISOS")
        print("   (Provavelmente falta apenas instalar dependências)\n")
        return 0
    else:
        print("\n❌ SISTEMA SCEAP v4.0 - PROBLEMAS DETECTADOS")
        print("   Corrija os erros acima antes de usar o sistema\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
