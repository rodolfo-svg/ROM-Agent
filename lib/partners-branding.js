/**
 * Sistema de Branding para Parceiros
 * Permite que cada escritório parceiro tenha sua própria identidade visual
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório para armazenar logos de parceiros
const PARTNERS_LOGOS_DIR = path.join(__dirname, '../public/img/partners');
const PARTNERS_DATA_FILE = path.join(__dirname, '../config/partners-branding.json');

// Criar diretórios se não existirem
if (!fs.existsSync(PARTNERS_LOGOS_DIR)) {
  fs.mkdirSync(PARTNERS_LOGOS_DIR, { recursive: true });
}

if (!fs.existsSync(path.dirname(PARTNERS_DATA_FILE))) {
  fs.mkdirSync(path.dirname(PARTNERS_DATA_FILE), { recursive: true });
}

// Branding padrão (ROM)
const DEFAULT_BRANDING = {
  id: 'rom',
  name: 'ROM',
  fullName: 'Rodolfo Otávio Mota',
  tagline: 'Redator de Obras Magistrais',
  subtitle: 'Seu assistente especializado em redação de peças jurídicas',
  logo: '/img/logo_rom.png',
  logoHeader: '/img/timbrado_header_LIMPO.png',
  colors: {
    primary: '#1a365d',
    primaryLight: '#2c5282',
    secondary: '#c9a227'
  },
  oab: 'OAB/GO 21.841',
  email: 'contato@rom.adv.br',
  website: 'https://rom.adv.br'
};

/**
 * Classe para gerenciar branding de parceiros
 */
class PartnersBranding {
  constructor() {
    this.partners = this.loadPartners();
  }

  /**
   * Carregar parceiros do arquivo JSON
   */
  loadPartners() {
    try {
      if (fs.existsSync(PARTNERS_DATA_FILE)) {
        const data = fs.readFileSync(PARTNERS_DATA_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error);
    }

    // Se não existir, criar com o padrão ROM
    const defaultData = {
      rom: DEFAULT_BRANDING
    };
    this.savePartners(defaultData);
    return defaultData;
  }

  /**
   * Salvar parceiros no arquivo JSON
   */
  savePartners(data = null) {
    try {
      const dataToSave = data || this.partners;
      fs.writeFileSync(PARTNERS_DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Erro ao salvar parceiros:', error);
      return false;
    }
  }

  /**
   * Obter branding de um parceiro
   */
  getBranding(partnerId = 'rom') {
    return this.partners[partnerId] || DEFAULT_BRANDING;
  }

  /**
   * Listar todos os parceiros
   */
  listPartners() {
    return Object.values(this.partners);
  }

  /**
   * Cadastrar novo parceiro
   */
  registerPartner(partnerData) {
    const partnerId = this.generatePartnerId(partnerData.name || partnerData.fullName);

    const newPartner = {
      id: partnerId,
      name: partnerData.name || partnerData.fullName.split(' ')[0],
      fullName: partnerData.fullName,
      tagline: partnerData.tagline || 'Advogados Associados',
      subtitle: partnerData.subtitle || 'Assistente jurídico especializado',
      logo: partnerData.logo || '/img/logo_rom.png', // Usar ROM como fallback
      logoHeader: partnerData.logoHeader || partnerData.logo || '/img/logo_rom.png',
      colors: partnerData.colors || DEFAULT_BRANDING.colors,
      oab: partnerData.oab || '',
      email: partnerData.email || '',
      website: partnerData.website || '',
      createdAt: new Date().toISOString(),
      active: true
    };

    this.partners[partnerId] = newPartner;
    this.savePartners();

    return newPartner;
  }

  /**
   * Atualizar parceiro existente
   */
  updatePartner(partnerId, updates) {
    if (!this.partners[partnerId]) {
      throw new Error('Parceiro não encontrado');
    }

    this.partners[partnerId] = {
      ...this.partners[partnerId],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.savePartners();
    return this.partners[partnerId];
  }

  /**
   * Atualizar logo do parceiro
   */
  updatePartnerLogo(partnerId, logoPath) {
    if (!this.partners[partnerId]) {
      throw new Error('Parceiro não encontrado');
    }

    this.partners[partnerId].logo = logoPath;
    this.partners[partnerId].logoHeader = logoPath;
    this.partners[partnerId].updatedAt = new Date().toISOString();

    this.savePartners();
    return this.partners[partnerId];
  }

  /**
   * Atualizar timbrado (letterhead) do parceiro
   */
  updatePartnerLetterhead(partnerId, letterheadPath) {
    if (!this.partners[partnerId]) {
      throw new Error('Parceiro não encontrado');
    }

    this.partners[partnerId].letterhead = letterheadPath;
    this.partners[partnerId].updatedAt = new Date().toISOString();

    this.savePartners();
    return this.partners[partnerId];
  }

  /**
   * Deletar parceiro
   */
  deletePartner(partnerId) {
    if (partnerId === 'rom') {
      throw new Error('Não é possível deletar o parceiro principal ROM');
    }

    if (!this.partners[partnerId]) {
      throw new Error('Parceiro não encontrado');
    }

    // Deletar logo se existir
    const logoPath = this.partners[partnerId].logo;
    if (logoPath && logoPath.includes('/partners/')) {
      const fullPath = path.join(__dirname, '../public', logoPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    delete this.partners[partnerId];
    this.savePartners();

    return true;
  }

  /**
   * Gerar ID único para parceiro
   */
  generatePartnerId(name) {
    const baseId = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let partnerId = baseId;
    let counter = 1;

    while (this.partners[partnerId]) {
      partnerId = `${baseId}-${counter}`;
      counter++;
    }

    return partnerId;
  }

  /**
   * Validar upload de logo
   */
  validateLogo(file) {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedMimes.includes(file.mimetype)) {
      throw new Error('Formato de imagem inválido. Use PNG, JPG ou SVG.');
    }

    if (file.size > maxSize) {
      throw new Error('Imagem muito grande. Máximo 5MB.');
    }

    return true;
  }

  /**
   * Obter caminho para salvar logo do parceiro
   */
  getPartnerLogoPath(partnerId, originalName) {
    const ext = path.extname(originalName);
    const filename = `${partnerId}-logo${ext}`;
    return path.join(PARTNERS_LOGOS_DIR, filename);
  }

  /**
   * Obter URL pública do logo
   */
  getPartnerLogoUrl(partnerId, originalName) {
    const ext = path.extname(originalName);
    return `/img/partners/${partnerId}-logo${ext}`;
  }
}

// Exportar instância única
const partnersBranding = new PartnersBranding();
export default partnersBranding;
export { DEFAULT_BRANDING };
