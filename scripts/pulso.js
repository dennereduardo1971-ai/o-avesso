// pulso.js — o mundo se mexendo entre uma sessão e outra.
//
// Como isto funciona, e por que assim:
//
// O tick NÃO é agendado. Não tem cron, não tem função no servidor, não tem
// nada acordando de madrugada. Quem vira a página é o mestre, ao fechar a
// sessão (botão no Caderno do Mestre). Dois motivos:
//
//   1. Infra: projeto Supabase no plano gratuito hiberna depois de uns dias
//      sem uso. Um "mundo vivo" com o coração num projeto que dorme falha
//      justamente no intervalo em que ele deveria brilhar.
//   2. Design, que pesa mais: evento gerado por máquina entre sessões vira
//      fato canônico que o mestre não autorizou e vai ter que reconciliar na
//      mesa seguinte. Com mestre humano, mundo vivo só é bom se ele puder
//      vetar. Aqui o mundo PROPÕE; quem aprova é ele, um por um.
//
// E é determinístico: as propostas saem do estado da mesa (posturas, relações,
// arcos, mapa, últimas rolagens), nunca de sorteio. O mesmo estado gera as
// mesmas propostas — o que muda entre viradas é o que a mesa fez, não o dado.
//
// Nada aqui grava: pensar e gravar são coisas separadas. Quem aplica é o
// Caderno do Mestre, depois do sim.

import { POSTURAS } from './regras.js';
import { ARCO_MAX, arco, chaveRelacao } from './elenco.js';
import { areaById } from './lugares.js';

const ORDEM_POSTURA = ['acolhedor', 'reservado', 'arredio'];

/** Um degrau na direção de fechar a porta. */
function piorar(postura) {
  const i = ORDEM_POSTURA.indexOf(postura);
  return ORDEM_POSTURA[Math.min(ORDEM_POSTURA.length - 1, (i < 0 ? 1 : i) + 1)];
}

/** Um degrau na direção de abrir. */
function melhorar(postura) {
  const i = ORDEM_POSTURA.indexOf(postura);
  return ORDEM_POSTURA[Math.max(0, (i < 0 ? 1 : i) - 1)];
}

function nomePostura(chave) {
  const p = POSTURAS.find((x) => x.chave === chave);
  return p ? p.nome : chave;
}

function relacoesDe(moradorId, relacoes) {
  const prefixo = moradorId + '::';
  return Object.keys(relacoes || {})
    .filter((k) => k.indexOf(prefixo) === 0)
    .map((k) => Object.assign({ visitante: k.slice(prefixo.length) }, relacoes[k]))
    .filter((r) => r.postura);
}

// ---- as regras -------------------------------------------------------------
// Cada uma olha o estado e devolve zero ou mais propostas. `peso` só ordena a
// fila: o que é mais consequente aparece antes.

const REGRAS = [
  // Região aberta, morador de lá ainda sem rosto. O mundo cobra a
  // apresentação antes de qualquer outra coisa.
  {
    nome: 'porta-aberta',
    peso: 10,
    propor(ctx) {
      return ctx.moradores
        .filter((m) => !m.revelado && m.local && ctx.regiaoRevelada(m.local))
        .map((m) => ({
          chave: `porta-aberta:${m.id}`,
          moradorId: m.id,
          titulo: `${m.nome} aparece`,
          texto: `A mesa já anda por ${areaById(m.local).nome} e ainda não esbarrou em quem vive ali. Da próxima vez, esbarra.`,
          motivo: `região revelada no mapa, morador ainda não apresentado`,
          efeito: { revelado: true },
          diario: `${m.nome} passou a ser visto por ${areaById(m.local).nome} — sempre esteve ali, dizem.`
        }));
    }
  },

  // Quem fechou a porta com a mesa inteira continua fechando. É o arco
  // andando por conta própria, que é o que faz o Avesso parecer vivo.
  {
    nome: 'fio-puxado',
    peso: 8,
    propor(ctx) {
      return ctx.moradores
        .filter((m) => m.revelado && m.postura === 'arredio' && m.arco < ARCO_MAX)
        .map((m) => {
          const proximo = arco(m.arco + 1);
          return {
            chave: `fio-puxado:${m.id}:${m.arco}`,
            moradorId: m.id,
            titulo: `${m.nome}: ${proximo.nome.toLowerCase()}`,
            texto: `Ninguém desarmou ${m.nome} desde a última virada. O que estava firme cedeu mais um ponto: ${proximo.desc}.`,
            motivo: `arredio com a mesa e arco em "${arco(m.arco).nome}"`,
            efeito: { arco: m.arco + 1 },
            diario: `Alguma coisa em ${m.nome} passou a estar visivelmente fora do lugar.`
          };
        });
    }
  },

  // A ponta oposta: quem foi tratado bem procura de volta. Sem isso o mundo
  // só piora, e mundo que só piora é castigo, não mundo.
  {
    nome: 'quem-procura',
    peso: 7,
    propor(ctx) {
      const saida = [];
      ctx.moradores.filter((m) => m.revelado).forEach((m) => {
        relacoesDe(m.id, ctx.relacoes)
          .filter((r) => r.postura === 'acolhedor')
          .forEach((r) => {
            const nome = ctx.nomeDoVisitante(r.visitante);
            saida.push({
              chave: `quem-procura:${m.id}:${r.visitante}`,
              moradorId: m.id,
              titulo: `${m.nome} procura ${nome}`,
              texto: `${m.nome} mandou recado, deixou algo na porta, ou simplesmente estava esperando. A relação virou iniciativa dele.`,
              motivo: `acolhedor com ${nome}`,
              efeito: { humor: `anda perguntando por ${nome}` },
              diario: `${m.nome} procurou ${nome} sem ser chamado.`
            });
          });
      });
      return saida;
    }
  },

  // Falhou um teste na frente de alguém? Esse alguém reparou. A brecha não é
  // punição: é o mundo lembrando do que viu.
  {
    nome: 'viu-a-brecha',
    peso: 6,
    propor(ctx) {
      return ctx.moradores
        .filter((m) => m.revelado && m.postura !== 'arredio' && ctx.falhouDiante(m.nome))
        .map((m) => ({
          chave: `viu-a-brecha:${m.id}:${m.postura}`,
          moradorId: m.id,
          titulo: `${m.nome} reparou`,
          texto: `Alguma coisa não saiu como devia na frente de ${m.nome}, e ele guardou isso. Fica ${nomePostura(piorar(m.postura))}.`,
          motivo: `falha registrada no histórico de rolagens diante dele`,
          efeito: { postura: piorar(m.postura) },
          diario: `${m.nome} passou a medir as palavras perto da mesa.`
        }));
    }
  },

  // Morador apresentado que ninguém procurou. Não vira hostil por isso — mas
  // deixa de estar disponível como estava.
  {
    nome: 'ninguem-bateu',
    peso: 4,
    propor(ctx) {
      return ctx.moradores
        .filter((m) => m.revelado
          && m.postura === 'acolhedor'
          && relacoesDe(m.id, ctx.relacoes).length === 0)
        .map((m) => ({
          chave: `ninguem-bateu:${m.id}`,
          moradorId: m.id,
          titulo: `${m.nome} desiste de esperar`,
          texto: `Estava de porta aberta e ninguém entrou. Volta a ser ${nomePostura(melhorar('arredio'))} — não por mágoa, por hábito.`,
          motivo: `acolhedor, mas sem nenhuma relação registrada com a mesa`,
          efeito: { postura: 'reservado', humor: 'parou de deixar a porta encostada' },
          diario: `${m.nome} voltou a atender só quem bate.`
        }));
    }
  },

  // Fim de arco: o evento grande. Só sai uma vez por morador, porque depois
  // dele a pessoa não é mais a mesma.
  {
    nome: 'do-avesso',
    peso: 9,
    propor(ctx) {
      return ctx.moradores
        .filter((m) => m.revelado && m.arco >= ARCO_MAX && !m.arcoFechado)
        .map((m) => ({
          chave: `do-avesso:${m.id}`,
          moradorId: m.id,
          titulo: `${m.nome} vira outra coisa`,
          texto: `O arco de ${m.nome} chegou ao fim: ${arco(ARCO_MAX).desc}. Decida com o que ele fica — e conte isso na mesa como consequência, não como surpresa.`,
          motivo: `arco no último estágio`,
          efeito: { humor: 'virou outra coisa — o mestre sabe o quê', postura: 'arredio', arcoFechado: true },
          diario: `Quem conhecia ${m.nome} de antes não reconheceria ${m.nome} agora.`
        }));
    }
  }
];

/**
 * Olha o estado da mesa e devolve a fila de propostas da próxima virada.
 * Não grava nada e não sorteia nada.
 *
 * @param {object} entrada
 * @param {Array}  entrada.moradores   elenco já montado (com postura/arco/revelado)
 * @param {object} entrada.relacoes    mapa chave->{postura, nota}
 * @param {object} entrada.pulso       { virada, descartados }
 * @param {object} entrada.mapa        estado das regiões ({ id: {descoberta} })
 * @param {Array}  entrada.historico   rolagens recentes da mesa
 * @param {Array}  entrada.visitantes  quem já atravessou ({ username, nome })
 * @param {number} [entrada.limite]    quantas propostas no máximo (padrão 5)
 */
export function proporVirada(entrada) {
  const moradores = entrada.moradores || [];
  const relacoes = entrada.relacoes || {};
  const pulso = entrada.pulso || { virada: 0, descartados: {} };
  const mapa = entrada.mapa || {};
  const historico = entrada.historico || [];
  const visitantes = entrada.visitantes || [];
  const limite = entrada.limite || 5;

  const ctx = {
    moradores: moradores,
    relacoes: relacoes,
    regiaoRevelada: (id) => Boolean(mapa[id] && mapa[id].descoberta),
    nomeDoVisitante: (username) => {
      const v = visitantes.find((x) => String(x.username).toLowerCase() === String(username).toLowerCase());
      return v ? v.nome : username;
    },
    // só as rolagens desde a última virada contam: o que ficou pra trás já
    // rendeu consequência na mesa, e não deve render de novo todo fim de sessão
    falhouDiante: (nome) => historico.some((h) =>
      h.diante === nome
      && h.veredito === 'falha'
      && (!pulso.ultima || (h.em && h.em > pulso.ultima)))
  };

  const propostas = [];
  REGRAS.forEach((regra) => {
    regra.propor(ctx).forEach((p) => {
      propostas.push(Object.assign({ regra: regra.nome, peso: regra.peso }, p));
    });
  });

  // O que o mestre descartou fica quieto por duas viradas: ele já disse não.
  const descartados = pulso.descartados || {};
  const vivas = propostas.filter((p) => {
    const quando = descartados[p.chave];
    return typeof quando !== 'number' || (pulso.virada - quando) >= 2;
  });

  // ordem estável: peso primeiro, depois o id — mesma entrada, mesma fila
  vivas.sort((a, b) => (b.peso - a.peso) || a.chave.localeCompare(b.chave));

  return vivas.slice(0, limite);
}

/**
 * Aplica uma proposta aprovada ao estado do elenco. Devolve o estado do
 * morador já mexido — quem grava é quem chamou.
 */
export function aplicarProposta(proposta, estadoDoMorador) {
  const estado = Object.assign({}, estadoDoMorador);
  const efeito = proposta.efeito || {};
  if (typeof efeito.revelado === 'boolean') estado.revelado = efeito.revelado;
  if (efeito.postura) estado.postura = efeito.postura;
  if (typeof efeito.arco === 'number') estado.arco = Math.max(0, Math.min(ARCO_MAX, efeito.arco));
  if (typeof efeito.humor === 'string') estado.humor = efeito.humor;
  if (efeito.arcoFechado) estado.arcoFechado = true;
  return estado;
}
