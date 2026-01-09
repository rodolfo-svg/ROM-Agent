/**
 * ROM Agent - Sistema de Gestão de Escritórios Parceiros
 *
 * Multi-tenancy com tarifação, cobrança e extratos de uso
 * Versão 1.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Arquivos de dados
const DATA_DIR = path.join(__dirname, '..', 'logs');
const PARTNERS_DIR = path.join(DATA_DIR, 'partners');
const PARTNERS_FILE = path.join(DATA_DIR, 'partners.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const BILLING_FILE = path.join(DATA_DIR, 'billing.json');
const INVOICES_DIR = path.join(DATA_DIR, 'invoices');

// Garantir diretórios
[DATA_DIR, PARTNERS_DIR, INVOICES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================================
// CUSTOS ADMINISTRATIVOS ROM
// ============================================================

/**
 * Markup de custos administrativos (30%)
 * Inclui: hospedagem, infraestrutura, suporte, manutenção,
 * licenças, backups, segurança, monitoramento, etc.
 */
export const ADMIN_MARKUP = 0.30; // 30%

/**
 * Aplica o markup administrativo ao custo de IA
 * @param {number} iaCost - Custo base da IA
 * @returns {object} - Custo detalhado com markup
 */
export function aplicarCustosAdministrativos(iaCost) {
  const adminCost = iaCost * ADMIN_MARKUP;
  const totalCost = iaCost + adminCost;

  return {
    custoIA: iaCost,
    custoAdmin: adminCost,
    custoTotal: totalCost,
    percentualAdmin: ADMIN_MARKUP * 100
  };
}

// ============================================================
// PLANOS DE ASSINATURA
// ============================================================

export const SUBSCRIPTION_PLANS = {
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    description: 'Para escritórios iniciantes',
    monthlyPrice: 297.00,
    includedPieces: 50,
    includedUsers: 2,
    pricePerExtraPiece: 5.90,
    pricePerExtraUser: 49.00,
    features: [
      'Até 50 peças/mês inclusas',
      'Até 2 usuários',
      'Modelos básicos (TIER 1-2)',
      'Suporte por email',
      'Relatórios básicos'
    ],
    allowedTiers: ['TIER_1_FAST', 'TIER_2_STANDARD'],
    discountAnnual: 0.15 // 15% desconto anual
  },

  PROFESSIONAL: {
    id: 'PROFESSIONAL',
    name: 'Professional',
    description: 'Para escritórios em crescimento',
    monthlyPrice: 697.00,
    includedPieces: 150,
    includedUsers: 5,
    pricePerExtraPiece: 4.90,
    pricePerExtraUser: 39.00,
    features: [
      'Até 150 peças/mês inclusas',
      'Até 5 usuários',
      'Todos os modelos (TIER 1-3)',
      'Suporte prioritário',
      'Relatórios avançados',
      'API de integração'
    ],
    allowedTiers: ['TIER_1_FAST', 'TIER_2_STANDARD', 'TIER_3_PREMIUM'],
    discountAnnual: 0.20
  },

  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Para grandes escritórios',
    monthlyPrice: 1497.00,
    includedPieces: 500,
    includedUsers: 15,
    pricePerExtraPiece: 3.90,
    pricePerExtraUser: 29.00,
    features: [
      'Até 500 peças/mês inclusas',
      'Até 15 usuários',
      'Todos os modelos incluindo ULTRA',
      'Suporte 24/7 dedicado',
      'Relatórios personalizados',
      'API completa',
      'Treinamento incluído',
      'SLA garantido'
    ],
    allowedTiers: ['TIER_1_FAST', 'TIER_2_STANDARD', 'TIER_3_PREMIUM', 'TIER_4_ULTRA'],
    discountAnnual: 0.25
  },

  UNLIMITED: {
    id: 'UNLIMITED',
    name: 'Unlimited',
    description: 'Uso ilimitado',
    monthlyPrice: 2997.00,
    includedPieces: -1, // ilimitado
    includedUsers: -1,  // ilimitado
    pricePerExtraPiece: 0,
    pricePerExtraUser: 0,
    features: [
      'Peças ilimitadas',
      'Usuários ilimitados',
      'Todos os recursos',
      'Suporte VIP dedicado',
      'Consultoria mensal',
      'Customizações exclusivas'
    ],
    allowedTiers: ['TIER_1_FAST', 'TIER_2_STANDARD', 'TIER_3_PREMIUM', 'TIER_4_ULTRA', 'TIER_5_VISION'],
    discountAnnual: 0.30
  }
};

// ============================================================
// ESTRUTURAS DE DADOS
// ============================================================

function getEmptyPartnersData() {
  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    partners: {},
    // ROM é o tenant principal (id: 'rom')
    romOffice: {
      id: 'rom',
      name: 'ROM Advocacia',
      cnpj: '00.000.000/0001-00',
      type: 'owner', // owner = dono do sistema
      status: 'active',
      createdAt: new Date().toISOString()
    }
  };
}

function getEmptyUsersData() {
  return {
    version: '1.0',
    users: {}
  };
}

function getEmptyBillingData() {
  return {
    version: '1.0',
    subscriptions: {},
    invoices: [],
    payments: [],
    usageRecords: []
  };
}

function createPartnerStructure(data) {
  return {
    id: data.id || `partner_${Date.now()}`,
    name: data.name,
    tradeName: data.tradeName || data.name,
    cnpj: data.cnpj,
    email: data.email,
    phone: data.phone,
    address: {
      street: data.street || '',
      number: data.number || '',
      complement: data.complement || '',
      neighborhood: data.neighborhood || '',
      city: data.city || '',
      state: data.state || '',
      zipCode: data.zipCode || ''
    },
    responsibleName: data.responsibleName,
    responsibleOab: data.responsibleOab,
    responsibleEmail: data.responsibleEmail,
    responsiblePhone: data.responsiblePhone,

    type: 'partner', // partner = escritório parceiro
    status: 'pending', // pending, active, suspended, cancelled

    // Configurações
    settings: {
      allowedTiers: [],
      maxUsers: 0,
      customBranding: false,
      apiAccess: false
    },

    // Estatísticas
    stats: {
      totalUsers: 0,
      totalPieces: 0,
      totalCost: 0,
      currentMonthPieces: 0,
      currentMonthCost: 0
    },

    // Datas
    createdAt: new Date().toISOString(),
    activatedAt: null,
    suspendedAt: null,
    cancelledAt: null,
    updatedAt: new Date().toISOString(),

    // Notas internas
    notes: []
  };
}

function createUserStructure(data) {
  return {
    id: data.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    partnerId: data.partnerId, // 'rom' para equipe ROM

    // Dados pessoais
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    oab: data.oab || '',
    oabState: data.oabState || '',

    // Credenciais (hash em produção)
    passwordHash: data.passwordHash || '',

    // Perfil
    role: data.role || 'user', // admin, manager, user
    permissions: data.permissions || ['create_pieces', 'view_own_pieces'],

    // Status
    status: 'active', // active, inactive, suspended
    emailVerified: false,

    // Estatísticas
    stats: {
      totalPieces: 0,
      totalCost: 0,
      lastActivity: null,
      totalSessions: 0
    },

    // Datas
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    updatedAt: new Date().toISOString()
  };
}

// ============================================================
// FUNÇÕES DE CARREGAMENTO/SALVAMENTO
// ============================================================

function loadPartners() {
  try {
    if (fs.existsSync(PARTNERS_FILE)) {
      return JSON.parse(fs.readFileSync(PARTNERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao carregar parceiros:', e.message);
  }
  return getEmptyPartnersData();
}

function savePartners(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(PARTNERS_FILE, JSON.stringify(data, null, 2));
}

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao carregar usuários:', e.message);
  }
  return getEmptyUsersData();
}

function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function loadBilling() {
  try {
    if (fs.existsSync(BILLING_FILE)) {
      return JSON.parse(fs.readFileSync(BILLING_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao carregar billing:', e.message);
  }
  return getEmptyBillingData();
}

function saveBilling(data) {
  fs.writeFileSync(BILLING_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// GESTÃO DE ESCRITÓRIOS PARCEIROS
// ============================================================

/**
 * Cadastra um novo escritório parceiro
 */
export function cadastrarParceiro(dados) {
  const partnersData = loadPartners();

  // Validar CNPJ único
  const existingCnpj = Object.values(partnersData.partners)
    .find(p => p.cnpj === dados.cnpj);
  if (existingCnpj) {
    return { success: false, error: 'CNPJ já cadastrado' };
  }

  const partner = createPartnerStructure(dados);
  partnersData.partners[partner.id] = partner;
  savePartners(partnersData);

  // Criar diretório específico do parceiro
  const partnerDir = path.join(PARTNERS_DIR, partner.id);
  if (!fs.existsSync(partnerDir)) {
    fs.mkdirSync(partnerDir, { recursive: true });
  }

  return { success: true, partnerId: partner.id, partner };
}

/**
 * Atualiza dados de um parceiro
 */
export function atualizarParceiro(partnerId, dados) {
  const partnersData = loadPartners();

  if (!partnersData.partners[partnerId]) {
    return { success: false, error: 'Parceiro não encontrado' };
  }

  const partner = partnersData.partners[partnerId];

  // Campos atualizáveis
  const updateableFields = [
    'name', 'tradeName', 'email', 'phone', 'responsibleName',
    'responsibleOab', 'responsibleEmail', 'responsiblePhone'
  ];

  for (const field of updateableFields) {
    if (dados[field] !== undefined) {
      partner[field] = dados[field];
    }
  }

  // Atualizar endereço
  if (dados.address) {
    partner.address = { ...partner.address, ...dados.address };
  }

  partner.updatedAt = new Date().toISOString();
  savePartners(partnersData);

  return { success: true, partner };
}

/**
 * Ativa um parceiro
 */
export function ativarParceiro(partnerId, planId = 'STARTER') {
  const partnersData = loadPartners();
  const billing = loadBilling();

  if (!partnersData.partners[partnerId]) {
    return { success: false, error: 'Parceiro não encontrado' };
  }

  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    return { success: false, error: 'Plano inválido' };
  }

  const partner = partnersData.partners[partnerId];
  partner.status = 'active';
  partner.activatedAt = new Date().toISOString();
  partner.settings.allowedTiers = plan.allowedTiers;
  partner.settings.maxUsers = plan.includedUsers;
  partner.updatedAt = new Date().toISOString();

  savePartners(partnersData);

  // Criar assinatura
  const subscription = {
    id: `sub_${Date.now()}`,
    partnerId,
    planId,
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };

  billing.subscriptions[partnerId] = subscription;
  saveBilling(billing);

  return { success: true, partner, subscription };
}

/**
 * Suspende um parceiro
 */
export function suspenderParceiro(partnerId, motivo = '') {
  const partnersData = loadPartners();

  if (!partnersData.partners[partnerId]) {
    return { success: false, error: 'Parceiro não encontrado' };
  }

  const partner = partnersData.partners[partnerId];
  partner.status = 'suspended';
  partner.suspendedAt = new Date().toISOString();
  partner.notes.push({
    date: new Date().toISOString(),
    type: 'suspension',
    message: motivo
  });
  partner.updatedAt = new Date().toISOString();

  savePartners(partnersData);

  return { success: true, partner };
}

/**
 * Cancela um parceiro
 */
export function cancelarParceiro(partnerId, motivo = '') {
  const partnersData = loadPartners();
  const billing = loadBilling();

  if (!partnersData.partners[partnerId]) {
    return { success: false, error: 'Parceiro não encontrado' };
  }

  const partner = partnersData.partners[partnerId];
  partner.status = 'cancelled';
  partner.cancelledAt = new Date().toISOString();
  partner.notes.push({
    date: new Date().toISOString(),
    type: 'cancellation',
    message: motivo
  });
  partner.updatedAt = new Date().toISOString();

  savePartners(partnersData);

  // Cancelar assinatura
  if (billing.subscriptions[partnerId]) {
    billing.subscriptions[partnerId].status = 'cancelled';
    billing.subscriptions[partnerId].cancelledAt = new Date().toISOString();
    saveBilling(billing);
  }

  return { success: true, partner };
}

/**
 * Lista todos os parceiros
 */
export function listarParceiros(filtros = {}) {
  const partnersData = loadPartners();
  let partners = Object.values(partnersData.partners);

  if (filtros.status) {
    partners = partners.filter(p => p.status === filtros.status);
  }

  if (filtros.search) {
    const search = filtros.search.toLowerCase();
    partners = partners.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.cnpj.includes(search) ||
      p.email.toLowerCase().includes(search)
    );
  }

  return partners;
}

/**
 * Obtém dados de um parceiro
 */
export function obterParceiro(partnerId) {
  const partnersData = loadPartners();
  return partnersData.partners[partnerId] || null;
}

// ============================================================
// GESTÃO DE USUÁRIOS
// ============================================================

/**
 * Cadastra um novo usuário
 */
export function cadastrarUsuario(dados) {
  const users = loadUsers();
  const partnersData = loadPartners();

  // Validar parceiro (exceto ROM)
  if (dados.partnerId !== 'rom' && !partnersData.partners[dados.partnerId]) {
    return { success: false, error: 'Escritório não encontrado' };
  }

  // Validar email único
  const existingEmail = Object.values(users.users)
    .find(u => u.email === dados.email);
  if (existingEmail) {
    return { success: false, error: 'Email já cadastrado' };
  }

  // Verificar limite de usuários (exceto ROM e planos ilimitados)
  if (dados.partnerId !== 'rom') {
    const partner = partnersData.partners[dados.partnerId];
    const billing = loadBilling();
    const subscription = billing.subscriptions[dados.partnerId];

    if (subscription) {
      const plan = SUBSCRIPTION_PLANS[subscription.planId];
      const partnerUsers = Object.values(users.users)
        .filter(u => u.partnerId === dados.partnerId && u.status === 'active');

      if (plan.includedUsers !== -1 && partnerUsers.length >= plan.includedUsers) {
        // Cobrar usuário extra
        console.log(`Usuário extra será cobrado: R$ ${plan.pricePerExtraUser}`);
      }
    }
  }

  const user = createUserStructure(dados);
  users.users[user.id] = user;
  saveUsers(users);

  // Atualizar contador do parceiro
  if (dados.partnerId !== 'rom' && partnersData.partners[dados.partnerId]) {
    partnersData.partners[dados.partnerId].stats.totalUsers++;
    savePartners(partnersData);
  }

  return { success: true, userId: user.id, user };
}

/**
 * Atualiza um usuário
 */
export function atualizarUsuario(userId, dados) {
  const users = loadUsers();

  if (!users.users[userId]) {
    return { success: false, error: 'Usuário não encontrado' };
  }

  const user = users.users[userId];

  const updateableFields = ['name', 'phone', 'oab', 'oabState', 'role', 'permissions'];
  for (const field of updateableFields) {
    if (dados[field] !== undefined) {
      user[field] = dados[field];
    }
  }

  user.updatedAt = new Date().toISOString();
  saveUsers(users);

  return { success: true, user };
}

/**
 * Desativa um usuário
 */
export function desativarUsuario(userId) {
  const users = loadUsers();

  if (!users.users[userId]) {
    return { success: false, error: 'Usuário não encontrado' };
  }

  users.users[userId].status = 'inactive';
  users.users[userId].updatedAt = new Date().toISOString();
  saveUsers(users);

  return { success: true };
}

/**
 * Lista usuários de um parceiro
 */
export function listarUsuarios(partnerId = null) {
  const users = loadUsers();
  let userList = Object.values(users.users);

  if (partnerId) {
    userList = userList.filter(u => u.partnerId === partnerId);
  }

  return userList;
}

/**
 * Obtém usuário por ID
 */
export function obterUsuario(userId) {
  const users = loadUsers();
  return users.users[userId] || null;
}

/**
 * Obtém usuário por email
 */
export function obterUsuarioPorEmail(email) {
  const users = loadUsers();
  return Object.values(users.users).find(u => u.email === email) || null;
}

// ============================================================
// TARIFAÇÃO E COBRANÇA
// ============================================================

/**
 * Registra uso de peça para tarifação
 */
export function registrarUso(dados) {
  const { userId, partnerId, pieceType, tier, cost, tokens } = dados;
  const billing = loadBilling();
  const partnersData = loadPartners();
  const users = loadUsers();

  const now = new Date();
  const month = now.toISOString().substring(0, 7);

  const usageRecord = {
    id: `usage_${Date.now()}`,
    userId,
    partnerId,
    pieceType,
    tier,
    cost,
    tokens,
    month,
    timestamp: now.toISOString()
  };

  billing.usageRecords.push(usageRecord);
  saveBilling(billing);

  // Atualizar estatísticas do parceiro
  if (partnerId !== 'rom' && partnersData.partners[partnerId]) {
    const partner = partnersData.partners[partnerId];
    partner.stats.totalPieces++;
    partner.stats.totalCost += cost;
    partner.stats.currentMonthPieces++;
    partner.stats.currentMonthCost += cost;
    partner.updatedAt = now.toISOString();
    savePartners(partnersData);
  }

  // Atualizar estatísticas do usuário
  if (users.users[userId]) {
    users.users[userId].stats.totalPieces++;
    users.users[userId].stats.totalCost += cost;
    users.users[userId].stats.lastActivity = now.toISOString();
    saveUsers(users);
  }

  return { success: true, usageId: usageRecord.id };
}

/**
 * Calcula fatura mensal de um parceiro
 */
export function calcularFatura(partnerId, mes = null) {
  const billing = loadBilling();
  const partnersData = loadPartners();
  const users = loadUsers();

  if (!partnersData.partners[partnerId]) {
    return { success: false, error: 'Parceiro não encontrado' };
  }

  const subscription = billing.subscriptions[partnerId];
  if (!subscription) {
    return { success: false, error: 'Sem assinatura ativa' };
  }

  const plan = SUBSCRIPTION_PLANS[subscription.planId];
  const targetMonth = mes || new Date().toISOString().substring(0, 7);

  // Calcular uso do mês
  const monthUsage = billing.usageRecords.filter(
    r => r.partnerId === partnerId && r.month === targetMonth
  );

  const totalPieces = monthUsage.length;
  const totalCostIA = monthUsage.reduce((sum, r) => sum + r.cost, 0);

  // Calcular usuários ativos
  const activeUsers = Object.values(users.users)
    .filter(u => u.partnerId === partnerId && u.status === 'active')
    .length;

  // Calcular valores
  let basePrice = plan.monthlyPrice;
  let extraPiecesCharge = 0;
  let extraUsersCharge = 0;

  // Peças extras
  if (plan.includedPieces !== -1 && totalPieces > plan.includedPieces) {
    const extraPieces = totalPieces - plan.includedPieces;
    extraPiecesCharge = extraPieces * plan.pricePerExtraPiece;
  }

  // Usuários extras
  if (plan.includedUsers !== -1 && activeUsers > plan.includedUsers) {
    const extraUsers = activeUsers - plan.includedUsers;
    extraUsersCharge = extraUsers * plan.pricePerExtraUser;
  }

  const subtotal = basePrice + extraPiecesCharge + extraUsersCharge;
  const totalAmount = subtotal;

  return {
    success: true,
    invoice: {
      partnerId,
      partnerName: partnersData.partners[partnerId].name,
      month: targetMonth,
      planId: subscription.planId,
      planName: plan.name,

      // Detalhamento
      basePrice,
      includedPieces: plan.includedPieces,
      totalPieces,
      extraPieces: Math.max(0, totalPieces - (plan.includedPieces === -1 ? totalPieces : plan.includedPieces)),
      pricePerExtraPiece: plan.pricePerExtraPiece,
      extraPiecesCharge,

      includedUsers: plan.includedUsers,
      activeUsers,
      extraUsers: Math.max(0, activeUsers - (plan.includedUsers === -1 ? activeUsers : plan.includedUsers)),
      pricePerExtraUser: plan.pricePerExtraUser,
      extraUsersCharge,

      // Custo real de IA (informativo)
      totalCostIA,

      // Totais
      subtotal,
      discount: 0,
      totalAmount,

      // Status
      status: 'pending',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Gera e salva fatura
 */
export function gerarFatura(partnerId, mes = null) {
  const result = calcularFatura(partnerId, mes);
  if (!result.success) return result;

  const billing = loadBilling();

  const invoice = {
    ...result.invoice,
    id: `inv_${Date.now()}`,
    invoiceNumber: `ROM-${Date.now().toString(36).toUpperCase()}`
  };

  billing.invoices.push(invoice);
  saveBilling(billing);

  // Salvar fatura em arquivo
  const invoiceFile = path.join(INVOICES_DIR, `${invoice.invoiceNumber}.json`);
  fs.writeFileSync(invoiceFile, JSON.stringify(invoice, null, 2));

  return { success: true, invoice };
}

/**
 * Registra pagamento
 */
export function registrarPagamento(invoiceId, dados) {
  const billing = loadBilling();

  const invoice = billing.invoices.find(i => i.id === invoiceId);
  if (!invoice) {
    return { success: false, error: 'Fatura não encontrada' };
  }

  const payment = {
    id: `pay_${Date.now()}`,
    invoiceId,
    partnerId: invoice.partnerId,
    amount: dados.amount || invoice.totalAmount,
    method: dados.method || 'pix', // pix, boleto, cartao, transferencia
    reference: dados.reference || '',
    paidAt: new Date().toISOString(),
    notes: dados.notes || ''
  };

  billing.payments.push(payment);

  // Atualizar status da fatura
  invoice.status = 'paid';
  invoice.paidAt = payment.paidAt;
  invoice.paymentId = payment.id;

  saveBilling(billing);

  return { success: true, payment };
}

/**
 * Lista faturas de um parceiro
 */
export function listarFaturas(partnerId = null, status = null) {
  const billing = loadBilling();
  let invoices = billing.invoices;

  if (partnerId) {
    invoices = invoices.filter(i => i.partnerId === partnerId);
  }

  if (status) {
    invoices = invoices.filter(i => i.status === status);
  }

  return invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ============================================================
// EXTRATOS DE USO
// ============================================================

/**
 * Gera extrato de uso de um parceiro
 */
export function gerarExtrato(partnerId, periodo = 'month') {
  const billing = loadBilling();
  const partnersData = loadPartners();
  const users = loadUsers();

  const partner = partnersData.partners[partnerId];
  if (!partner) {
    return { success: false, error: 'Parceiro não encontrado' };
  }

  const now = new Date();
  let startDate, endDate;

  switch (periodo) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = now;
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
  }

  // Filtrar registros de uso
  const usageRecords = billing.usageRecords.filter(r =>
    r.partnerId === partnerId &&
    new Date(r.timestamp) >= startDate &&
    new Date(r.timestamp) <= endDate
  );

  // Agregar por usuário
  const byUser = {};
  for (const record of usageRecords) {
    if (!byUser[record.userId]) {
      const user = users.users[record.userId];
      byUser[record.userId] = {
        userId: record.userId,
        userName: user ? user.name : 'Usuário Desconhecido',
        pieces: 0,
        cost: 0,
        byType: {},
        byTier: {}
      };
    }
    byUser[record.userId].pieces++;
    byUser[record.userId].cost += record.cost;

    // Por tipo
    if (!byUser[record.userId].byType[record.pieceType]) {
      byUser[record.userId].byType[record.pieceType] = { count: 0, cost: 0 };
    }
    byUser[record.userId].byType[record.pieceType].count++;
    byUser[record.userId].byType[record.pieceType].cost += record.cost;

    // Por tier
    if (!byUser[record.userId].byTier[record.tier]) {
      byUser[record.userId].byTier[record.tier] = { count: 0, cost: 0 };
    }
    byUser[record.userId].byTier[record.tier].count++;
    byUser[record.userId].byTier[record.tier].cost += record.cost;
  }

  // Agregar por tipo de peça
  const byPieceType = {};
  for (const record of usageRecords) {
    if (!byPieceType[record.pieceType]) {
      byPieceType[record.pieceType] = { count: 0, cost: 0 };
    }
    byPieceType[record.pieceType].count++;
    byPieceType[record.pieceType].cost += record.cost;
  }

  // Agregar por tier
  const byTier = {};
  for (const record of usageRecords) {
    if (!byTier[record.tier]) {
      byTier[record.tier] = { count: 0, cost: 0 };
    }
    byTier[record.tier].count++;
    byTier[record.tier].cost += record.cost;
  }

  // Agregar por dia
  const byDay = {};
  for (const record of usageRecords) {
    const day = record.timestamp.split('T')[0];
    if (!byDay[day]) {
      byDay[day] = { count: 0, cost: 0 };
    }
    byDay[day].count++;
    byDay[day].cost += record.cost;
  }

  const totalPieces = usageRecords.length;
  const totalCostIA = usageRecords.reduce((sum, r) => sum + r.cost, 0);
  const activeUsers = Object.keys(byUser).length;

  // Aplicar custos administrativos (30%)
  const custos = aplicarCustosAdministrativos(totalCostIA);

  // Aplicar markup em cada usuário
  const usuariosComMarkup = Object.values(byUser).map(u => ({
    ...u,
    custoIA: u.cost,
    custoAdmin: u.cost * ADMIN_MARKUP,
    custoTotal: u.cost * (1 + ADMIN_MARKUP),
    byType: Object.fromEntries(
      Object.entries(u.byType).map(([type, stats]) => [type, {
        ...stats,
        custoIA: stats.cost,
        custoAdmin: stats.cost * ADMIN_MARKUP,
        custoTotal: stats.cost * (1 + ADMIN_MARKUP)
      }])
    ),
    byTier: Object.fromEntries(
      Object.entries(u.byTier).map(([tier, stats]) => [tier, {
        ...stats,
        custoIA: stats.cost,
        custoAdmin: stats.cost * ADMIN_MARKUP,
        custoTotal: stats.cost * (1 + ADMIN_MARKUP)
      }])
    )
  })).sort((a, b) => b.pieces - a.pieces);

  return {
    success: true,
    extrato: {
      partnerId,
      partnerName: partner.name,
      periodo: {
        tipo: periodo,
        inicio: startDate.toISOString(),
        fim: endDate.toISOString()
      },
      resumo: {
        totalPieces,
        custoIA: custos.custoIA,
        custoAdmin: custos.custoAdmin,
        custoTotal: custos.custoTotal,
        percentualAdmin: custos.percentualAdmin,
        activeUsers,
        avgPiecesPerUser: activeUsers > 0 ? (totalPieces / activeUsers).toFixed(1) : 0,
        avgCostPerPiece: totalPieces > 0 ? (custos.custoTotal / totalPieces).toFixed(4) : 0
      },
      porUsuario: usuariosComMarkup,
      porTipoPeca: Object.entries(byPieceType)
        .map(([type, stats]) => ({
          type,
          count: stats.count,
          custoIA: stats.cost,
          custoAdmin: stats.cost * ADMIN_MARKUP,
          custoTotal: stats.cost * (1 + ADMIN_MARKUP)
        }))
        .sort((a, b) => b.count - a.count),
      porTier: Object.entries(byTier)
        .map(([tier, stats]) => ({
          tier,
          count: stats.count,
          custoIA: stats.cost,
          custoAdmin: stats.cost * ADMIN_MARKUP,
          custoTotal: stats.cost * (1 + ADMIN_MARKUP)
        }))
        .sort((a, b) => b.count - a.count),
      porDia: Object.entries(byDay)
        .map(([day, stats]) => ({
          day,
          count: stats.count,
          custoIA: stats.cost,
          custoAdmin: stats.cost * ADMIN_MARKUP,
          custoTotal: stats.cost * (1 + ADMIN_MARKUP)
        }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      notaFiscal: {
        descricao: 'Custos administrativos incluem: hospedagem, infraestrutura, suporte técnico, manutenção, licenças de software, backups, segurança e monitoramento.',
        markup: `${ADMIN_MARKUP * 100}%`
      },
      geradoEm: new Date().toISOString()
    }
  };
}

// ============================================================
// RELATÓRIOS
// ============================================================

/**
 * Relatório geral de parceiros
 */
export function relatorioParceiros() {
  const partnersData = loadPartners();
  const billing = loadBilling();
  const users = loadUsers();

  const partners = Object.values(partnersData.partners);
  const activePartners = partners.filter(p => p.status === 'active');
  const totalUsers = Object.values(users.users).filter(u => u.partnerId !== 'rom').length;
  const romUsers = Object.values(users.users).filter(u => u.partnerId === 'rom').length;

  // Calcular receita do mês
  const currentMonth = new Date().toISOString().substring(0, 7);
  const monthInvoices = billing.invoices.filter(i => i.month === currentMonth);
  const monthRevenue = monthInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const paidRevenue = monthInvoices.filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.totalAmount, 0);

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║              ROM AGENT - RELATÓRIO DE ESCRITÓRIOS PARCEIROS                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

════════════════════════════════════════════════════════════════════════════════
RESUMO GERAL
════════════════════════════════════════════════════════════════════════════════
  Total de Parceiros:         ${partners.length}
  Parceiros Ativos:           ${activePartners.length}
  Parceiros Pendentes:        ${partners.filter(p => p.status === 'pending').length}
  Parceiros Suspensos:        ${partners.filter(p => p.status === 'suspended').length}

  Usuários de Parceiros:      ${totalUsers}
  Usuários ROM (interno):     ${romUsers}

  Receita do Mês:             R$ ${monthRevenue.toFixed(2)}
  Receita Recebida:           R$ ${paidRevenue.toFixed(2)}
  Receita Pendente:           R$ ${(monthRevenue - paidRevenue).toFixed(2)}

════════════════════════════════════════════════════════════════════════════════
PARCEIROS POR PLANO
════════════════════════════════════════════════════════════════════════════════`;

  for (const planId of Object.keys(SUBSCRIPTION_PLANS)) {
    const planPartners = activePartners.filter(p => {
      const sub = billing.subscriptions[p.id];
      return sub && sub.planId === planId;
    });
    if (planPartners.length > 0) {
      report += `
  ${SUBSCRIPTION_PLANS[planId].name}: ${planPartners.length} parceiros`;
    }
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
TOP 10 PARCEIROS (por uso)
════════════════════════════════════════════════════════════════════════════════`;

  const sortedPartners = [...partners]
    .sort((a, b) => b.stats.totalPieces - a.stats.totalPieces)
    .slice(0, 10);

  for (const partner of sortedPartners) {
    const partnerUsers = Object.values(users.users).filter(u => u.partnerId === partner.id).length;
    const sub = billing.subscriptions[partner.id];
    const planName = sub ? SUBSCRIPTION_PLANS[sub.planId]?.name || 'N/A' : 'Sem plano';
    const custos = aplicarCustosAdministrativos(partner.stats.totalCost);
    report += `
  ${partner.name}
    Status: ${partner.status} | Plano: ${planName}
    Peças: ${partner.stats.totalPieces} | Usuários: ${partnerUsers}
    Custo IA: $${custos.custoIA.toFixed(2)} | Admin: $${custos.custoAdmin.toFixed(2)} | Total: $${custos.custoTotal.toFixed(2)}`;
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
FATURAS PENDENTES
════════════════════════════════════════════════════════════════════════════════`;

  const pendingInvoices = billing.invoices.filter(i => i.status === 'pending');
  if (pendingInvoices.length === 0) {
    report += `
  Nenhuma fatura pendente.`;
  } else {
    for (const inv of pendingInvoices.slice(0, 10)) {
      report += `
  ${inv.invoiceNumber} - ${inv.partnerName}
    Valor: R$ ${inv.totalAmount.toFixed(2)} | Vencimento: ${inv.dueDate.split('T')[0]}`;
    }
  }

  return report;
}

/**
 * Relatório detalhado de um parceiro
 */
export function relatorioParceiro(partnerId) {
  const partnersData = loadPartners();
  const billing = loadBilling();
  const users = loadUsers();

  const partner = partnersData.partners[partnerId];
  if (!partner) {
    return 'Parceiro não encontrado';
  }

  const subscription = billing.subscriptions[partnerId];
  const plan = subscription ? SUBSCRIPTION_PLANS[subscription.planId] : null;
  const partnerUsers = Object.values(users.users).filter(u => u.partnerId === partnerId);
  const partnerInvoices = billing.invoices.filter(i => i.partnerId === partnerId);

  // Extrato do mês
  const extratoResult = gerarExtrato(partnerId, 'month');
  const extrato = extratoResult.success ? extratoResult.extrato : null;

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ROM AGENT - RELATÓRIO DO PARCEIRO                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

════════════════════════════════════════════════════════════════════════════════
DADOS DO ESCRITÓRIO
════════════════════════════════════════════════════════════════════════════════
  Nome:                       ${partner.name}
  Nome Fantasia:              ${partner.tradeName}
  CNPJ:                       ${partner.cnpj}
  Email:                      ${partner.email}
  Telefone:                   ${partner.phone}
  Status:                     ${partner.status.toUpperCase()}

  RESPONSÁVEL
  ───────────────────────────────────────────────────────────────────────────────
  Nome:                       ${partner.responsibleName}
  OAB:                        ${partner.responsibleOab}
  Email:                      ${partner.responsibleEmail}

  DATAS
  ───────────────────────────────────────────────────────────────────────────────
  Cadastro:                   ${partner.createdAt.split('T')[0]}
  Ativação:                   ${partner.activatedAt ? partner.activatedAt.split('T')[0] : 'N/A'}

════════════════════════════════════════════════════════════════════════════════
ASSINATURA
════════════════════════════════════════════════════════════════════════════════`;

  if (plan) {
    report += `
  Plano:                      ${plan.name}
  Valor Mensal:               R$ ${plan.monthlyPrice.toFixed(2)}
  Peças Inclusas:             ${plan.includedPieces === -1 ? 'Ilimitado' : plan.includedPieces}
  Usuários Inclusos:          ${plan.includedUsers === -1 ? 'Ilimitado' : plan.includedUsers}
  Período Atual:              ${subscription.currentPeriodStart.split('T')[0]} até ${subscription.currentPeriodEnd.split('T')[0]}`;
  } else {
    report += `
  Sem assinatura ativa`;
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
USUÁRIOS (${partnerUsers.length})
════════════════════════════════════════════════════════════════════════════════`;

  for (const user of partnerUsers) {
    report += `
  ${user.name} (${user.role})
    Email: ${user.email} | OAB: ${user.oab || 'N/A'}
    Peças: ${user.stats.totalPieces} | Status: ${user.status}`;
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
USO DO MÊS ATUAL
════════════════════════════════════════════════════════════════════════════════`;

  if (extrato) {
    report += `
  Total de Peças:             ${extrato.resumo.totalPieces}
  Usuários Ativos:            ${extrato.resumo.activeUsers}
  Média Peças/Usuário:        ${extrato.resumo.avgPiecesPerUser}

  CUSTOS DETALHADOS
  ───────────────────────────────────────────────────────────────────────────────
  Custo IA (base):            $${extrato.resumo.custoIA.toFixed(4)}
  Custos Administrativos:     $${extrato.resumo.custoAdmin.toFixed(4)} (+${extrato.resumo.percentualAdmin}%)
  CUSTO TOTAL:                $${extrato.resumo.custoTotal.toFixed(4)}

  (Custos admin: hospedagem, infraestrutura, suporte, manutenção)

  POR TIPO DE PEÇA
  ───────────────────────────────────────────────────────────────────────────────`;

    for (const item of extrato.porTipoPeca.slice(0, 5)) {
      report += `
  ${item.type}: ${item.count} peças | $${item.custoTotal.toFixed(4)} (IA: $${item.custoIA.toFixed(4)} + Admin: $${item.custoAdmin.toFixed(4)})`;
    }

    report += `

  POR USUÁRIO
  ───────────────────────────────────────────────────────────────────────────────`;

    for (const item of extrato.porUsuario) {
      report += `
  ${item.userName}: ${item.pieces} peças
    Custo IA: $${item.custoIA.toFixed(4)} | Admin: $${item.custoAdmin.toFixed(4)} | TOTAL: $${item.custoTotal.toFixed(4)}`;
    }
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
HISTÓRICO DE FATURAS
════════════════════════════════════════════════════════════════════════════════`;

  if (partnerInvoices.length === 0) {
    report += `
  Nenhuma fatura emitida.`;
  } else {
    for (const inv of partnerInvoices.slice(0, 6)) {
      const statusIcon = inv.status === 'paid' ? '✓' : inv.status === 'pending' ? '○' : '✗';
      report += `
  ${statusIcon} ${inv.invoiceNumber} - ${inv.month}
    Valor: R$ ${inv.totalAmount.toFixed(2)} | Status: ${inv.status}`;
    }
  }

  // Custos históricos com markup
  const custosHistoricos = aplicarCustosAdministrativos(partner.stats.totalCost);

  report += `

════════════════════════════════════════════════════════════════════════════════
ESTATÍSTICAS TOTAIS (com custos administrativos +${ADMIN_MARKUP * 100}%)
════════════════════════════════════════════════════════════════════════════════
  Total de Peças (histórico): ${partner.stats.totalPieces}
  Custo IA (histórico):       $${custosHistoricos.custoIA.toFixed(4)}
  Custos Administrativos:     $${custosHistoricos.custoAdmin.toFixed(4)}
  CUSTO TOTAL HISTÓRICO:      $${custosHistoricos.custoTotal.toFixed(4)}
  Total de Usuários:          ${partner.stats.totalUsers}

════════════════════════════════════════════════════════════════════════════════
NOTA: Custos administrativos (+30%) incluem hospedagem AWS, infraestrutura,
suporte técnico, manutenção, licenças, backups, segurança e monitoramento 24/7.
════════════════════════════════════════════════════════════════════════════════
`;

  return report;
}

/**
 * Dashboard de faturamento
 */
export function dashboardFaturamento() {
  const billing = loadBilling();
  const partnersData = loadPartners();
  const users = loadUsers();

  const now = new Date();
  const currentMonth = now.toISOString().substring(0, 7);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7);

  // Métricas do mês atual
  const currentInvoices = billing.invoices.filter(i => i.month === currentMonth);
  const currentRevenue = currentInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const currentPaid = currentInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.totalAmount, 0);

  // Métricas do mês anterior
  const lastInvoices = billing.invoices.filter(i => i.month === lastMonth);
  const lastRevenue = lastInvoices.reduce((sum, i) => sum + i.totalAmount, 0);

  // Crescimento
  const growth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue * 100).toFixed(1) : 0;

  // MRR (Monthly Recurring Revenue)
  const activeSubscriptions = Object.values(billing.subscriptions).filter(s => s.status === 'active');
  const mrr = activeSubscriptions.reduce((sum, s) => {
    const plan = SUBSCRIPTION_PLANS[s.planId];
    return sum + (plan ? plan.monthlyPrice : 0);
  }, 0);

  // Uso do mês
  const monthUsage = billing.usageRecords.filter(r => r.month === currentMonth);
  const totalPiecesMonth = monthUsage.length;
  const totalCostIAMonth = monthUsage.reduce((sum, r) => sum + r.cost, 0);

  // Aplicar custos administrativos
  const custosMonth = aplicarCustosAdministrativos(totalCostIAMonth);

  // Margem operacional (receita - custo total)
  const margemOperacional = currentRevenue - custosMonth.custoTotal;
  const margemPercent = currentRevenue > 0 ? (margemOperacional / currentRevenue * 100).toFixed(1) : 0;

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ROM AGENT - DASHBOARD DE FATURAMENTO                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │   RECEITA MÊS       │  │   MRR               │  │   CRESCIMENTO       │
  │                     │  │                     │  │                     │
  │   R$ ${currentRevenue.toFixed(2).padStart(10)}   │  │   R$ ${mrr.toFixed(2).padStart(10)}   │  │   ${String(growth).padStart(8)}%       │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │   RECEBIDO          │  │   PENDENTE          │  │   INADIMPLÊNCIA     │
  │                     │  │                     │  │                     │
  │   R$ ${currentPaid.toFixed(2).padStart(10)}   │  │   R$ ${(currentRevenue - currentPaid).toFixed(2).padStart(10)}   │  │   ${((1 - currentPaid / Math.max(1, currentRevenue)) * 100).toFixed(1).padStart(8)}%       │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │   PEÇAS (MÊS)       │  │   ASSINATURAS       │  │   MARGEM OPER.      │
  │                     │  │                     │  │                     │
  │   ${String(totalPiecesMonth).padStart(12)}     │  │   ${String(activeSubscriptions.length).padStart(12)}     │  │   ${String(margemPercent).padStart(8)}%       │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

════════════════════════════════════════════════════════════════════════════════
CUSTOS OPERACIONAIS DO MÊS (com markup administrativo +${ADMIN_MARKUP * 100}%)
════════════════════════════════════════════════════════════════════════════════
  Custo IA (base):            $ ${custosMonth.custoIA.toFixed(2).padStart(10)}
  Custos Administrativos:     $ ${custosMonth.custoAdmin.toFixed(2).padStart(10)} (+30% hospedagem, infra, etc.)
  ──────────────────────────────────────────────────
  CUSTO OPERACIONAL TOTAL:    $ ${custosMonth.custoTotal.toFixed(2).padStart(10)}
  RECEITA DO MÊS:             R$ ${currentRevenue.toFixed(2).padStart(10)}
  MARGEM BRUTA:               R$ ${margemOperacional.toFixed(2).padStart(10)} (${margemPercent}%)

════════════════════════════════════════════════════════════════════════════════
DISTRIBUIÇÃO POR PLANO
════════════════════════════════════════════════════════════════════════════════`;

  for (const [planId, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
    const planSubs = activeSubscriptions.filter(s => s.planId === planId);
    const planRevenue = planSubs.length * plan.monthlyPrice;
    if (planSubs.length > 0) {
      report += `
  ${plan.name}: ${planSubs.length} assinaturas | R$ ${planRevenue.toFixed(2)}/mês`;
    }
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
ÚLTIMOS PAGAMENTOS
════════════════════════════════════════════════════════════════════════════════`;

  const recentPayments = billing.payments.slice(-5).reverse();
  if (recentPayments.length === 0) {
    report += `
  Nenhum pagamento registrado.`;
  } else {
    for (const pay of recentPayments) {
      const partner = partnersData.partners[pay.partnerId];
      report += `
  [${pay.paidAt.split('T')[0]}] ${partner?.name || pay.partnerId}
    R$ ${pay.amount.toFixed(2)} - ${pay.method.toUpperCase()}`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESCRITÓRIOS PARCEIROS
  // ═══════════════════════════════════════════════════════════════════════════

  const partners = Object.values(partnersData.partners);
  const activePartners = partners.filter(p => p.status === 'active');
  const pendingPartners = partners.filter(p => p.status === 'pending');
  const suspendedPartners = partners.filter(p => p.status === 'suspended');

  report += `

════════════════════════════════════════════════════════════════════════════════
ESCRITÓRIOS PARCEIROS (${partners.length} total)
════════════════════════════════════════════════════════════════════════════════
  ✅ Ativos: ${activePartners.length} | ⏳ Pendentes: ${pendingPartners.length} | ⛔ Suspensos: ${suspendedPartners.length}
`;

  // Listar parceiros ativos
  if (activePartners.length > 0) {
    report += `
  PARCEIROS ATIVOS
  ───────────────────────────────────────────────────────────────────────────────`;
    for (const partner of activePartners) {
      const sub = billing.subscriptions[partner.id];
      const plan = sub ? SUBSCRIPTION_PLANS[sub.planId] : null;
      const partnerUsers = Object.values(users.users).filter(u => u.partnerId === partner.id);
      const activeUsers = partnerUsers.filter(u => u.status === 'active').length;
      const custos = aplicarCustosAdministrativos(partner.stats.totalCost);

      report += `
  📁 ${partner.tradeName || partner.name}
     Plano: ${plan ? plan.name : 'N/A'} | Usuários: ${activeUsers}/${plan ? (plan.includedUsers === -1 ? '∞' : plan.includedUsers) : 0}
     Peças: ${partner.stats.totalPieces} | Custo Total: $${custos.custoTotal.toFixed(2)}`;
    }
  }

  // Listar parceiros pendentes
  if (pendingPartners.length > 0) {
    report += `

  PARCEIROS PENDENTES (aguardando ativação)
  ───────────────────────────────────────────────────────────────────────────────`;
    for (const partner of pendingPartners) {
      report += `
  ⏳ ${partner.name}
     Responsável: ${partner.responsibleName} | Desde: ${partner.createdAt.split('T')[0]}`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USUÁRIOS POR ESCRITÓRIO
  // ═══════════════════════════════════════════════════════════════════════════

  const allUsers = Object.values(users.users);
  const romUsers = allUsers.filter(u => u.partnerId === 'rom');
  const partnerUsers = allUsers.filter(u => u.partnerId !== 'rom');

  report += `

════════════════════════════════════════════════════════════════════════════════
USUÁRIOS DO SISTEMA (${allUsers.length} total)
════════════════════════════════════════════════════════════════════════════════

  EQUIPE ROM (${romUsers.length} usuários)
  ───────────────────────────────────────────────────────────────────────────────`;

  if (romUsers.length === 0) {
    report += `
  Nenhum usuário ROM cadastrado.`;
  } else {
    for (const user of romUsers) {
      const roleIcon = user.role === 'admin' ? '👑' : user.role === 'manager' ? '⭐' : '👤';
      const statusIcon = user.status === 'active' ? '✅' : '⛔';
      report += `
  ${statusIcon} ${roleIcon} ${user.name}
     ${user.email} | OAB: ${user.oab || 'N/A'}-${user.oabState || ''} | ${user.role}
     Peças: ${user.stats.totalPieces} | Último acesso: ${user.lastLoginAt ? user.lastLoginAt.split('T')[0] : 'Nunca'}`;
    }
  }

  report += `

  USUÁRIOS DE PARCEIROS (${partnerUsers.length} usuários)
  ───────────────────────────────────────────────────────────────────────────────`;

  if (partnerUsers.length === 0) {
    report += `
  Nenhum usuário de parceiro cadastrado.`;
  } else {
    // Agrupar por parceiro
    const usersByPartner = {};
    for (const user of partnerUsers) {
      if (!usersByPartner[user.partnerId]) {
        usersByPartner[user.partnerId] = [];
      }
      usersByPartner[user.partnerId].push(user);
    }

    for (const [partnerId, partnerUserList] of Object.entries(usersByPartner)) {
      const partner = partnersData.partners[partnerId];
      const partnerName = partner ? (partner.tradeName || partner.name) : partnerId;

      report += `

  📁 ${partnerName} (${partnerUserList.length} usuários)`;

      for (const user of partnerUserList) {
        const roleIcon = user.role === 'admin' ? '👑' : user.role === 'manager' ? '⭐' : '👤';
        const statusIcon = user.status === 'active' ? '✅' : '⛔';
        report += `
     ${statusIcon} ${roleIcon} ${user.name}
        ${user.email} | OAB: ${user.oab || 'N/A'}-${user.oabState || ''} | ${user.role}
        Peças: ${user.stats.totalPieces}`;
      }
    }
  }

  // Resumo final
  report += `

════════════════════════════════════════════════════════════════════════════════
RESUMO GERAL
════════════════════════════════════════════════════════════════════════════════
  Escritórios Parceiros:      ${partners.length} (${activePartners.length} ativos)
  Usuários ROM:               ${romUsers.length}
  Usuários Parceiros:         ${partnerUsers.length}
  Total de Usuários:          ${allUsers.length}
  Total de Peças (mês):       ${totalPiecesMonth}
  Custo Operacional:          $${custosMonth.custoTotal.toFixed(2)} (IA + Admin 30%)
`;

  return report;
}

// ============================================================
// DASHBOARDS SEPARADOS POR ENTIDADE
// ============================================================

/**
 * Dashboard exclusivo para um escritório parceiro
 * (visão do parceiro - como se fosse seu próprio sistema)
 */
export function dashboardEscritorio(partnerId) {
  const billing = loadBilling();
  const partnersData = loadPartners();
  const users = loadUsers();

  const partner = partnersData.partners[partnerId];
  if (!partner) {
    return 'Erro: Escritório não encontrado';
  }

  const subscription = billing.subscriptions[partnerId];
  const plan = subscription ? SUBSCRIPTION_PLANS[subscription.planId] : null;

  const now = new Date();
  const currentMonth = now.toISOString().substring(0, 7);

  // Usuários do escritório
  const escritorioUsers = Object.values(users.users).filter(u => u.partnerId === partnerId);
  const activeUsers = escritorioUsers.filter(u => u.status === 'active');

  // Uso do mês
  const monthUsage = billing.usageRecords.filter(
    r => r.partnerId === partnerId && r.month === currentMonth
  );
  const totalPiecesMonth = monthUsage.length;
  const totalCostIAMonth = monthUsage.reduce((sum, r) => sum + r.cost, 0);
  const custosMonth = aplicarCustosAdministrativos(totalCostIAMonth);

  // Uso por usuário no mês
  const usageByUser = {};
  for (const record of monthUsage) {
    if (!usageByUser[record.userId]) {
      usageByUser[record.userId] = { pieces: 0, cost: 0 };
    }
    usageByUser[record.userId].pieces++;
    usageByUser[record.userId].cost += record.cost;
  }

  // Faturas do escritório
  const escritorioInvoices = billing.invoices.filter(i => i.partnerId === partnerId);
  const pendingInvoices = escritorioInvoices.filter(i => i.status === 'pending');
  const totalPending = pendingInvoices.reduce((sum, i) => sum + i.totalAmount, 0);

  // Limites do plano
  const piecesUsed = totalPiecesMonth;
  const piecesLimit = plan ? (plan.includedPieces === -1 ? '∞' : plan.includedPieces) : 0;
  const usersUsed = activeUsers.length;
  const usersLimit = plan ? (plan.includedUsers === -1 ? '∞' : plan.includedUsers) : 0;

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ${(partner.tradeName || partner.name).toUpperCase().padStart(30).padEnd(50)}║
║                         DASHBOARD DO ESCRITÓRIO                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

  Plano: ${plan ? plan.name : 'Sem plano'} | Status: ${partner.status.toUpperCase()}
  Período: ${subscription ? subscription.currentPeriodStart.split('T')[0] : 'N/A'} até ${subscription ? subscription.currentPeriodEnd.split('T')[0] : 'N/A'}

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │   PEÇAS (MÊS)       │  │   USUÁRIOS ATIVOS   │  │   CUSTO DO MÊS      │
  │                     │  │                     │  │                     │
  │   ${String(piecesUsed).padStart(6)}/${String(piecesLimit).padStart(6)}   │  │   ${String(usersUsed).padStart(6)}/${String(usersLimit).padStart(6)}   │  │   $${custosMonth.custoTotal.toFixed(2).padStart(12)}   │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

════════════════════════════════════════════════════════════════════════════════
DETALHAMENTO DE CUSTOS DO MÊS
════════════════════════════════════════════════════════════════════════════════
  Custo IA (processamento):   $${custosMonth.custoIA.toFixed(4).padStart(12)}
  Custos Administrativos:     $${custosMonth.custoAdmin.toFixed(4).padStart(12)} (+${ADMIN_MARKUP * 100}%)
  ──────────────────────────────────────────────────
  CUSTO TOTAL DO MÊS:         $${custosMonth.custoTotal.toFixed(4).padStart(12)}
  Custo Médio por Peça:       $${(totalPiecesMonth > 0 ? custosMonth.custoTotal / totalPiecesMonth : 0).toFixed(4).padStart(12)}

════════════════════════════════════════════════════════════════════════════════
USUÁRIOS DO ESCRITÓRIO (${escritorioUsers.length})
════════════════════════════════════════════════════════════════════════════════`;

  if (escritorioUsers.length === 0) {
    report += `
  Nenhum usuário cadastrado.`;
  } else {
    for (const user of escritorioUsers) {
      const roleIcon = user.role === 'admin' ? '👑' : user.role === 'manager' ? '⭐' : '👤';
      const statusIcon = user.status === 'active' ? '✅' : '⛔';
      const userUsage = usageByUser[user.id] || { pieces: 0, cost: 0 };
      const userCustos = aplicarCustosAdministrativos(userUsage.cost);

      report += `
  ${statusIcon} ${roleIcon} ${user.name} (${user.role})
     Email: ${user.email}
     OAB: ${user.oab || 'N/A'}-${user.oabState || ''}
     Peças (mês): ${userUsage.pieces} | Custo: $${userCustos.custoTotal.toFixed(4)}
     Total histórico: ${user.stats.totalPieces} peças`;
    }
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
PRODUÇÃO POR USUÁRIO (${currentMonth})
════════════════════════════════════════════════════════════════════════════════`;

  const sortedUserUsage = Object.entries(usageByUser)
    .map(([userId, stats]) => {
      const user = users.users[userId];
      return { userId, userName: user ? user.name : 'Desconhecido', ...stats };
    })
    .sort((a, b) => b.pieces - a.pieces);

  if (sortedUserUsage.length === 0) {
    report += `
  Nenhuma produção registrada no mês.`;
  } else {
    const maxPieces = sortedUserUsage[0]?.pieces || 1;
    for (const item of sortedUserUsage) {
      const barLength = Math.round((item.pieces / maxPieces) * 20);
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      const custos = aplicarCustosAdministrativos(item.cost);
      report += `
  ${item.userName.padEnd(25)} ${bar} ${String(item.pieces).padStart(4)} peças | $${custos.custoTotal.toFixed(2)}`;
    }
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
FATURAS
════════════════════════════════════════════════════════════════════════════════
  Faturas Pendentes: ${pendingInvoices.length} | Total: R$ ${totalPending.toFixed(2)}
`;

  if (escritorioInvoices.length > 0) {
    report += `
  HISTÓRICO DE FATURAS
  ───────────────────────────────────────────────────────────────────────────────`;
    for (const inv of escritorioInvoices.slice(-6)) {
      const statusIcon = inv.status === 'paid' ? '✅' : inv.status === 'pending' ? '⏳' : '❌';
      report += `
  ${statusIcon} ${inv.invoiceNumber} | ${inv.month} | R$ ${inv.totalAmount.toFixed(2)} | ${inv.status}`;
    }
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
LIMITES DO PLANO
════════════════════════════════════════════════════════════════════════════════`;

  if (plan) {
    const piecesPercent = plan.includedPieces === -1 ? 0 : (piecesUsed / plan.includedPieces * 100);
    const usersPercent = plan.includedUsers === -1 ? 0 : (usersUsed / plan.includedUsers * 100);

    const piecesBar = plan.includedPieces === -1 ? '∞ ILIMITADO' :
      '█'.repeat(Math.min(20, Math.round(piecesPercent / 5))) + '░'.repeat(Math.max(0, 20 - Math.round(piecesPercent / 5)));
    const usersBar = plan.includedUsers === -1 ? '∞ ILIMITADO' :
      '█'.repeat(Math.min(20, Math.round(usersPercent / 5))) + '░'.repeat(Math.max(0, 20 - Math.round(usersPercent / 5)));

    report += `
  Peças:    ${piecesBar} ${piecesUsed}/${piecesLimit} (${piecesPercent.toFixed(0)}%)
  Usuários: ${usersBar} ${usersUsed}/${usersLimit} (${usersPercent.toFixed(0)}%)`;

    if (plan.includedPieces !== -1 && piecesUsed > plan.includedPieces) {
      const extraPieces = piecesUsed - plan.includedPieces;
      report += `

  ⚠️  EXCEDENTE: ${extraPieces} peças extras | R$ ${(extraPieces * plan.pricePerExtraPiece).toFixed(2)} adicional`;
    }
  } else {
    report += `
  Sem plano ativo. Contate o suporte para ativar.`;
  }

  report += `
`;

  return report;
}

/**
 * Relatório de usuários de um escritório parceiro
 */
export function relatorioUsuariosEscritorio(partnerId) {
  const billing = loadBilling();
  const partnersData = loadPartners();
  const users = loadUsers();

  const partner = partnersData.partners[partnerId];
  if (!partner) {
    return 'Erro: Escritório não encontrado';
  }

  const escritorioUsers = Object.values(users.users).filter(u => u.partnerId === partnerId);
  const currentMonth = new Date().toISOString().substring(0, 7);

  // Uso do mês por usuário
  const monthUsage = billing.usageRecords.filter(
    r => r.partnerId === partnerId && r.month === currentMonth
  );

  const usageByUser = {};
  for (const record of monthUsage) {
    if (!usageByUser[record.userId]) {
      usageByUser[record.userId] = {
        pieces: 0,
        cost: 0,
        byType: {},
        byTier: {}
      };
    }
    usageByUser[record.userId].pieces++;
    usageByUser[record.userId].cost += record.cost;

    if (!usageByUser[record.userId].byType[record.pieceType]) {
      usageByUser[record.userId].byType[record.pieceType] = 0;
    }
    usageByUser[record.userId].byType[record.pieceType]++;

    if (!usageByUser[record.userId].byTier[record.tier]) {
      usageByUser[record.userId].byTier[record.tier] = 0;
    }
    usageByUser[record.userId].byTier[record.tier]++;
  }

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ${(partner.tradeName || partner.name).toUpperCase().padStart(30).padEnd(50)}║
║                       RELATÓRIO DE USUÁRIOS                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

  Total de Usuários: ${escritorioUsers.length}
  Ativos: ${escritorioUsers.filter(u => u.status === 'active').length}
  Inativos: ${escritorioUsers.filter(u => u.status !== 'active').length}

════════════════════════════════════════════════════════════════════════════════
DETALHAMENTO POR USUÁRIO
════════════════════════════════════════════════════════════════════════════════`;

  for (const user of escritorioUsers) {
    const roleIcon = user.role === 'admin' ? '👑' : user.role === 'manager' ? '⭐' : '👤';
    const statusIcon = user.status === 'active' ? '✅' : '⛔';
    const usage = usageByUser[user.id] || { pieces: 0, cost: 0, byType: {}, byTier: {} };
    const custos = aplicarCustosAdministrativos(usage.cost);
    const custosHistorico = aplicarCustosAdministrativos(user.stats.totalCost);

    report += `

┌──────────────────────────────────────────────────────────────────────────────┐
│ ${statusIcon} ${roleIcon} ${user.name.padEnd(60)}│
├──────────────────────────────────────────────────────────────────────────────┤
│  Email:        ${user.email.padEnd(55)}│
│  OAB:          ${(user.oab || 'N/A').padEnd(55)}│
│  Estado:       ${(user.oabState || 'N/A').padEnd(55)}│
│  Função:       ${user.role.padEnd(55)}│
│  Status:       ${user.status.padEnd(55)}│
│  Cadastro:     ${user.createdAt.split('T')[0].padEnd(55)}│
│  Último Login: ${(user.lastLoginAt ? user.lastLoginAt.split('T')[0] : 'Nunca').padEnd(55)}│
├──────────────────────────────────────────────────────────────────────────────┤
│  PRODUÇÃO DO MÊS (${currentMonth})                                             │
│  ────────────────────────────────────────────────────────────────────────────│
│  Peças:        ${String(usage.pieces).padEnd(55)}│
│  Custo IA:     $${usage.cost.toFixed(4).padEnd(54)}│
│  Custo Admin:  $${custos.custoAdmin.toFixed(4).padEnd(54)}│
│  Custo Total:  $${custos.custoTotal.toFixed(4).padEnd(54)}│
├──────────────────────────────────────────────────────────────────────────────┤
│  HISTÓRICO TOTAL                                                             │
│  ────────────────────────────────────────────────────────────────────────────│
│  Total Peças:  ${String(user.stats.totalPieces).padEnd(55)}│
│  Custo Total:  $${custosHistorico.custoTotal.toFixed(4).padEnd(54)}│
└──────────────────────────────────────────────────────────────────────────────┘`;

    // Tipos de peça
    if (Object.keys(usage.byType).length > 0) {
      report += `
  Peças por Tipo:`;
      for (const [type, count] of Object.entries(usage.byType).sort((a, b) => b[1] - a[1])) {
        report += `
    • ${type}: ${count}`;
      }
    }
  }

  return report;
}

/**
 * Relatório de tarifação de um escritório parceiro
 */
export function relatorioTarifacaoEscritorio(partnerId) {
  const billing = loadBilling();
  const partnersData = loadPartners();
  const users = loadUsers();

  const partner = partnersData.partners[partnerId];
  if (!partner) {
    return 'Erro: Escritório não encontrado';
  }

  const subscription = billing.subscriptions[partnerId];
  const plan = subscription ? SUBSCRIPTION_PLANS[subscription.planId] : null;

  const now = new Date();
  const currentMonth = now.toISOString().substring(0, 7);

  // Uso dos últimos 6 meses
  const last6Months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6Months.push(d.toISOString().substring(0, 7));
  }

  // Calcular uso por mês
  const usageByMonth = {};
  for (const month of last6Months) {
    const monthRecords = billing.usageRecords.filter(
      r => r.partnerId === partnerId && r.month === month
    );
    usageByMonth[month] = {
      pieces: monthRecords.length,
      costIA: monthRecords.reduce((sum, r) => sum + r.cost, 0)
    };
  }

  // Faturas
  const invoices = billing.invoices.filter(i => i.partnerId === partnerId);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.totalAmount, 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.totalAmount, 0);

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ${(partner.tradeName || partner.name).toUpperCase().padStart(30).padEnd(50)}║
║                       RELATÓRIO DE TARIFAÇÃO                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

════════════════════════════════════════════════════════════════════════════════
PLANO ATUAL
════════════════════════════════════════════════════════════════════════════════`;

  if (plan) {
    report += `
  Plano:                    ${plan.name}
  Valor Mensal:             R$ ${plan.monthlyPrice.toFixed(2)}
  Peças Inclusas:           ${plan.includedPieces === -1 ? 'Ilimitado' : plan.includedPieces}
  Preço Peça Extra:         R$ ${plan.pricePerExtraPiece.toFixed(2)}
  Usuários Inclusos:        ${plan.includedUsers === -1 ? 'Ilimitado' : plan.includedUsers}
  Preço Usuário Extra:      R$ ${plan.pricePerExtraUser.toFixed(2)}
  Desconto Anual:           ${(plan.discountAnnual * 100).toFixed(0)}%

  Tiers Permitidos:         ${plan.allowedTiers.join(', ')}`;
  } else {
    report += `
  Sem plano ativo.`;
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
USO DOS ÚLTIMOS 6 MESES
════════════════════════════════════════════════════════════════════════════════
  Mês        │ Peças │   Custo IA   │ Custo Admin  │ Custo Total  │ Excedente
  ───────────┼───────┼──────────────┼──────────────┼──────────────┼───────────`;

  for (const month of last6Months.reverse()) {
    const usage = usageByMonth[month];
    const custos = aplicarCustosAdministrativos(usage.costIA);
    const excedente = plan && plan.includedPieces !== -1 && usage.pieces > plan.includedPieces
      ? (usage.pieces - plan.includedPieces) * plan.pricePerExtraPiece
      : 0;

    report += `
  ${month}  │ ${String(usage.pieces).padStart(5)} │ $${usage.costIA.toFixed(4).padStart(10)} │ $${custos.custoAdmin.toFixed(4).padStart(10)} │ $${custos.custoTotal.toFixed(4).padStart(10)} │ R$ ${excedente.toFixed(2).padStart(7)}`;
  }

  // Totais históricos
  const custosHistoricos = aplicarCustosAdministrativos(partner.stats.totalCost);

  report += `

════════════════════════════════════════════════════════════════════════════════
TOTAIS HISTÓRICOS
════════════════════════════════════════════════════════════════════════════════
  Total de Peças:           ${partner.stats.totalPieces}
  Custo IA Acumulado:       $${custosHistoricos.custoIA.toFixed(4)}
  Custos Admin Acumulados:  $${custosHistoricos.custoAdmin.toFixed(4)}
  CUSTO TOTAL ACUMULADO:    $${custosHistoricos.custoTotal.toFixed(4)}

════════════════════════════════════════════════════════════════════════════════
FATURAS
════════════════════════════════════════════════════════════════════════════════
  Total Pago:               R$ ${totalPaid.toFixed(2)}
  Total Pendente:           R$ ${totalPending.toFixed(2)}

  HISTÓRICO DE FATURAS
  ───────────────────────────────────────────────────────────────────────────────`;

  if (invoices.length === 0) {
    report += `
  Nenhuma fatura emitida.`;
  } else {
    report += `
  Número         │ Mês     │ Base      │ Extras    │ Total     │ Status    │ Pago em`;
    for (const inv of invoices.slice(-12)) {
      const statusIcon = inv.status === 'paid' ? '✅' : inv.status === 'pending' ? '⏳' : '❌';
      report += `
  ${inv.invoiceNumber.padEnd(14)} │ ${inv.month} │ R$ ${inv.basePrice.toFixed(0).padStart(5)} │ R$ ${(inv.extraPiecesCharge + inv.extraUsersCharge).toFixed(0).padStart(5)} │ R$ ${inv.totalAmount.toFixed(0).padStart(5)} │ ${statusIcon} ${inv.status.padEnd(7)} │ ${inv.paidAt ? inv.paidAt.split('T')[0] : '-'}`;
    }
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
COMPOSIÇÃO DO CUSTO
════════════════════════════════════════════════════════════════════════════════

  Os custos são compostos por:

  1. CUSTO DE IA (base)
     - Processamento de linguagem natural
     - Geração de textos jurídicos
     - Análise e revisão de documentos

  2. CUSTOS ADMINISTRATIVOS (+${ADMIN_MARKUP * 100}%)
     - Hospedagem AWS (servidores, CDN, storage)
     - Infraestrutura de rede e segurança
     - Backups automáticos e redundância
     - Suporte técnico especializado
     - Manutenção e atualizações do sistema
     - Licenças de software
     - Monitoramento 24/7
     - Certificados SSL/TLS
     - Conformidade LGPD

`;

  return report;
}

/**
 * Dashboard da equipe ROM (interno)
 */
export function dashboardROM() {
  const billing = loadBilling();
  const partnersData = loadPartners();
  const users = loadUsers();

  const now = new Date();
  const currentMonth = now.toISOString().substring(0, 7);

  // Usuários ROM
  const romUsers = Object.values(users.users).filter(u => u.partnerId === 'rom');

  // Uso ROM do mês
  const romUsage = billing.usageRecords.filter(
    r => r.partnerId === 'rom' && r.month === currentMonth
  );
  const totalPiecesMonth = romUsage.length;
  const totalCostIAMonth = romUsage.reduce((sum, r) => sum + r.cost, 0);
  const custosMonth = aplicarCustosAdministrativos(totalCostIAMonth);

  // Uso por usuário
  const usageByUser = {};
  for (const record of romUsage) {
    if (!usageByUser[record.userId]) {
      usageByUser[record.userId] = { pieces: 0, cost: 0 };
    }
    usageByUser[record.userId].pieces++;
    usageByUser[record.userId].cost += record.cost;
  }

  let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                         ROM ADVOCACIA                                         ║
║                      DASHBOARD INTERNO                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │   PEÇAS (MÊS)       │  │   USUÁRIOS ROM      │  │   CUSTO DO MÊS      │
  │                     │  │                     │  │                     │
  │   ${String(totalPiecesMonth).padStart(12)}     │  │   ${String(romUsers.length).padStart(12)}     │  │   $${custosMonth.custoTotal.toFixed(2).padStart(12)}   │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

════════════════════════════════════════════════════════════════════════════════
CUSTOS ROM DO MÊS
════════════════════════════════════════════════════════════════════════════════
  Custo IA:               $${custosMonth.custoIA.toFixed(4)}
  Custos Administrativos: $${custosMonth.custoAdmin.toFixed(4)} (+${ADMIN_MARKUP * 100}%)
  CUSTO TOTAL:            $${custosMonth.custoTotal.toFixed(4)}

════════════════════════════════════════════════════════════════════════════════
EQUIPE ROM (${romUsers.length} usuários)
════════════════════════════════════════════════════════════════════════════════`;

  for (const user of romUsers) {
    const roleIcon = user.role === 'admin' ? '👑' : user.role === 'manager' ? '⭐' : '👤';
    const statusIcon = user.status === 'active' ? '✅' : '⛔';
    const userUsage = usageByUser[user.id] || { pieces: 0, cost: 0 };
    const userCustos = aplicarCustosAdministrativos(userUsage.cost);

    report += `
  ${statusIcon} ${roleIcon} ${user.name} (${user.role})
     ${user.email} | OAB: ${user.oab || 'N/A'}-${user.oabState || ''}
     Peças (mês): ${userUsage.pieces} | Custo: $${userCustos.custoTotal.toFixed(4)}
     Total histórico: ${user.stats.totalPieces} peças`;
  }

  report += `

════════════════════════════════════════════════════════════════════════════════
PRODUÇÃO ROM POR USUÁRIO (${currentMonth})
════════════════════════════════════════════════════════════════════════════════`;

  const sortedUserUsage = Object.entries(usageByUser)
    .map(([userId, stats]) => {
      const user = users.users[userId];
      return { userId, userName: user ? user.name : 'Desconhecido', ...stats };
    })
    .sort((a, b) => b.pieces - a.pieces);

  if (sortedUserUsage.length === 0) {
    report += `
  Nenhuma produção registrada no mês.`;
  } else {
    const maxPieces = sortedUserUsage[0]?.pieces || 1;
    for (const item of sortedUserUsage) {
      const barLength = Math.round((item.pieces / maxPieces) * 20);
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      const custos = aplicarCustosAdministrativos(item.cost);
      report += `
  ${item.userName.padEnd(25)} ${bar} ${String(item.pieces).padStart(4)} peças | $${custos.custoTotal.toFixed(2)}`;
    }
  }

  report += `
`;

  return report;
}

// ============================================================
// EXPORTAÇÕES
// ============================================================

export default {
  // Custos administrativos
  ADMIN_MARKUP,
  aplicarCustosAdministrativos,

  // Planos
  SUBSCRIPTION_PLANS,

  // Parceiros
  cadastrarParceiro,
  atualizarParceiro,
  ativarParceiro,
  suspenderParceiro,
  cancelarParceiro,
  listarParceiros,
  obterParceiro,

  // Usuários
  cadastrarUsuario,
  atualizarUsuario,
  desativarUsuario,
  listarUsuarios,
  obterUsuario,
  obterUsuarioPorEmail,

  // Tarifação
  registrarUso,
  calcularFatura,
  gerarFatura,
  registrarPagamento,
  listarFaturas,

  // Extratos
  gerarExtrato,

  // Relatórios
  relatorioParceiros,
  relatorioParceiro,
  dashboardFaturamento,

  // Dashboards por entidade
  dashboardEscritorio,
  relatorioUsuariosEscritorio,
  relatorioTarifacaoEscritorio,
  dashboardROM
};

// ============================================================
// CLI
// ============================================================

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'dashboard') {
    console.log(dashboardFaturamento());
  } else if (cmd === 'parceiros') {
    console.log(relatorioParceiros());
  } else if (cmd === 'parceiro') {
    if (!args[1]) {
      console.log('Uso: node lib/partners.js parceiro <partnerId>');
    } else {
      console.log(relatorioParceiro(args[1]));
    }
  } else if (cmd === 'extrato') {
    if (!args[1]) {
      console.log('Uso: node lib/partners.js extrato <partnerId> [periodo]');
    } else {
      const result = gerarExtrato(args[1], args[2] || 'month');
      if (result.success) {
        console.log(JSON.stringify(result.extrato, null, 2));
      } else {
        console.log('Erro:', result.error);
      }
    }
  } else if (cmd === 'planos') {
    console.log('\n═══ PLANOS DISPONÍVEIS ═══\n');
    for (const [id, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
      console.log(`${plan.name} (${id})`);
      console.log(`  Preço: R$ ${plan.monthlyPrice.toFixed(2)}/mês`);
      console.log(`  Peças: ${plan.includedPieces === -1 ? 'Ilimitado' : plan.includedPieces}`);
      console.log(`  Usuários: ${plan.includedUsers === -1 ? 'Ilimitado' : plan.includedUsers}`);
      console.log(`  Features: ${plan.features.join(', ')}`);
      console.log('');
    }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMANDOS POR ENTIDADE (Escritórios Parceiros e ROM)
  // ═══════════════════════════════════════════════════════════════════════════

  } else if (cmd === 'escritorio') {
    if (!args[1]) {
      console.log('Uso: node lib/partners.js escritorio <partnerId>');
      console.log('     Dashboard completo do escritório parceiro');
    } else {
      console.log(dashboardEscritorio(args[1]));
    }

  } else if (cmd === 'usuarios') {
    if (!args[1]) {
      console.log('Uso: node lib/partners.js usuarios <partnerId>');
      console.log('     Relatório de usuários do escritório');
    } else {
      console.log(relatorioUsuariosEscritorio(args[1]));
    }

  } else if (cmd === 'tarifacao') {
    if (!args[1]) {
      console.log('Uso: node lib/partners.js tarifacao <partnerId>');
      console.log('     Relatório de tarifação do escritório');
    } else {
      console.log(relatorioTarifacaoEscritorio(args[1]));
    }

  } else if (cmd === 'rom') {
    console.log(dashboardROM());

  } else if (cmd === 'listar') {
    // Listar IDs dos parceiros para facilitar
    const partnersData = loadPartners();
    console.log('\n═══ ESCRITÓRIOS CADASTRADOS ═══\n');
    const partners = Object.values(partnersData.partners);
    if (partners.length === 0) {
      console.log('Nenhum escritório cadastrado.');
    } else {
      for (const p of partners) {
        console.log(`  ${p.id}`);
        console.log(`    Nome: ${p.tradeName || p.name}`);
        console.log(`    Status: ${p.status}`);
        console.log('');
      }
    }

  } else if (cmd === 'test') {
    // Reset e criar dados de teste
    savePartners(getEmptyPartnersData());
    saveUsers(getEmptyUsersData());
    saveBilling(getEmptyBillingData());

    // Criar usuários ROM
    cadastrarUsuario({
      partnerId: 'rom',
      name: 'Dr. Rodolfo Otávio',
      email: 'rodolfo@rom.adv.br',
      oab: '21.841',
      oabState: 'GO',
      role: 'admin'
    });

    cadastrarUsuario({
      partnerId: 'rom',
      name: 'Dra. Ana Paula',
      email: 'ana@rom.adv.br',
      oab: '15.432',
      oabState: 'GO',
      role: 'manager'
    });

    // Criar parceiros de teste
    const parceiro1 = cadastrarParceiro({
      name: 'Silva & Associados Advogados',
      tradeName: 'Silva Advogados',
      cnpj: '12.345.678/0001-90',
      email: 'contato@silvaadvogados.com.br',
      phone: '(62) 3333-4444',
      responsibleName: 'Dr. Carlos Silva',
      responsibleOab: 'GO 10.123',
      responsibleEmail: 'carlos@silvaadvogados.com.br',
      city: 'Goiânia',
      state: 'GO'
    });

    if (parceiro1.success) {
      ativarParceiro(parceiro1.partnerId, 'PROFESSIONAL');

      // Criar usuários do parceiro
      cadastrarUsuario({
        partnerId: parceiro1.partnerId,
        name: 'Dr. Carlos Silva',
        email: 'carlos@silvaadvogados.com.br',
        oab: '10.123',
        oabState: 'GO',
        role: 'admin'
      });

      cadastrarUsuario({
        partnerId: parceiro1.partnerId,
        name: 'Dra. Marina Santos',
        email: 'marina@silvaadvogados.com.br',
        oab: '22.456',
        oabState: 'GO',
        role: 'user'
      });

      // Registrar uso
      for (let i = 0; i < 25; i++) {
        const userId = i % 2 === 0 ? 'user_1' : 'user_2';
        registrarUso({
          userId,
          partnerId: parceiro1.partnerId,
          pieceType: ['peticao_inicial', 'contestacao', 'recurso', 'notificacao'][Math.floor(Math.random() * 4)],
          tier: ['TIER_1_FAST', 'TIER_2_STANDARD', 'TIER_3_PREMIUM'][Math.floor(Math.random() * 3)],
          cost: 0.01 + Math.random() * 0.5,
          tokens: 1000 + Math.floor(Math.random() * 5000)
        });
      }

      // Gerar fatura
      gerarFatura(parceiro1.partnerId);
    }

    const parceiro2 = cadastrarParceiro({
      name: 'Oliveira Advocacia Empresarial',
      tradeName: 'Oliveira Advocacia',
      cnpj: '98.765.432/0001-10',
      email: 'contato@oliveiraadv.com.br',
      phone: '(62) 4444-5555',
      responsibleName: 'Dr. Pedro Oliveira',
      responsibleOab: 'GO 8.765',
      responsibleEmail: 'pedro@oliveiraadv.com.br',
      city: 'Goiânia',
      state: 'GO'
    });

    if (parceiro2.success) {
      ativarParceiro(parceiro2.partnerId, 'ENTERPRISE');

      cadastrarUsuario({
        partnerId: parceiro2.partnerId,
        name: 'Dr. Pedro Oliveira',
        email: 'pedro@oliveiraadv.com.br',
        oab: '8.765',
        oabState: 'GO',
        role: 'admin'
      });

      // Registrar uso
      for (let i = 0; i < 75; i++) {
        registrarUso({
          userId: 'user_3',
          partnerId: parceiro2.partnerId,
          pieceType: ['recurso_especial', 'mandado_seguranca', 'apelacao', 'peticao_inicial'][Math.floor(Math.random() * 4)],
          tier: ['TIER_2_STANDARD', 'TIER_3_PREMIUM', 'TIER_4_ULTRA'][Math.floor(Math.random() * 3)],
          cost: 0.05 + Math.random() * 0.8,
          tokens: 2000 + Math.floor(Math.random() * 10000)
        });
      }

      gerarFatura(parceiro2.partnerId);
    }

    // Criar parceiro pendente
    cadastrarParceiro({
      name: 'Santos & Souza Advogados',
      cnpj: '11.222.333/0001-44',
      email: 'contato@santossouza.com.br',
      phone: '(62) 5555-6666',
      responsibleName: 'Dr. João Santos',
      responsibleOab: 'GO 5.432',
      responsibleEmail: 'joao@santossouza.com.br'
    });

    console.log('Dados de teste criados!\n');
    console.log(dashboardFaturamento());

  } else {
    console.log(`
ROM Agent - Sistema de Gestão de Parceiros v2.0

════════════════════════════════════════════════════════════════════════════════
DASHBOARD GERAL (Visão ROM - Administrador)
════════════════════════════════════════════════════════════════════════════════
  node lib/partners.js dashboard              - Dashboard completo de faturamento
  node lib/partners.js parceiros              - Relatório geral de parceiros
  node lib/partners.js listar                 - Listar IDs dos escritórios

════════════════════════════════════════════════════════════════════════════════
EQUIPE ROM (Uso interno)
════════════════════════════════════════════════════════════════════════════════
  node lib/partners.js rom                    - Dashboard da equipe ROM

════════════════════════════════════════════════════════════════════════════════
ESCRITÓRIOS PARCEIROS (Visão do Parceiro)
════════════════════════════════════════════════════════════════════════════════
  node lib/partners.js escritorio <id>        - Dashboard do escritório
  node lib/partners.js usuarios <id>          - Relatório de usuários do escritório
  node lib/partners.js tarifacao <id>         - Relatório de tarifação do escritório
  node lib/partners.js parceiro <id>          - Relatório detalhado (visão admin)
  node lib/partners.js extrato <id> [periodo] - Extrato de uso (week/month/year)

════════════════════════════════════════════════════════════════════════════════
CONFIGURAÇÕES
════════════════════════════════════════════════════════════════════════════════
  node lib/partners.js planos                 - Lista planos disponíveis
  node lib/partners.js test                   - Criar dados de teste

════════════════════════════════════════════════════════════════════════════════
CUSTOS ADMINISTRATIVOS: +${ADMIN_MARKUP * 100}% sobre custo IA
(Hospedagem, infraestrutura, suporte, manutenção, licenças, backups, etc.)
════════════════════════════════════════════════════════════════════════════════
`);
  }
}
