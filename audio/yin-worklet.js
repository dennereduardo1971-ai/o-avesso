// O YIN rodando dentro da thread de áudio.
//
// POR QUE UM WORKLET
// Na thread principal, cada detecção disputa espaço com o desenho da tela. O
// mostrador rolante precisa de 16 ms por quadro e a detecção come uma boa
// fatia disso — o resultado é uma linha que anda aos solavancos justamente
// enquanto a pessoa canta, que é quando ela mais precisa ser lida. Aqui a
// detecção acontece longe da tela e chega pronta, por mensagem.
//
// O processador não devolve áudio: só escuta. `process` retorna true sempre,
// pra não ser recolhido quando não há saída conectada.

import { criarDetectorYin } from './yin.js';

class ProcessadorYin extends AudioWorkletProcessor {
  constructor(opcoes) {
    super();
    const config = (opcoes && opcoes.processorOptions) || {};

    this.tamanho = config.tamanho || 2048;
    // De quantas em quantas amostras vale a pena detectar de novo. 512 a 48 kHz
    // dá ~94 leituras por segundo: mais que o suficiente pra uma tela de 60 fps,
    // e pouco o bastante pra sobrar thread de áudio.
    this.salto = config.salto || 512;

    this.detector = criarDetectorYin({
      taxaAmostragem: sampleRate,
      tamanho: this.tamanho,
      limiar: config.limiar,
      rmsMinimo: config.rmsMinimo,
      frequenciaMinima: config.frequenciaMinima,
      frequenciaMaxima: config.frequenciaMaxima,
    });

    this.anel = new Float32Array(this.tamanho);
    this.janela = new Float32Array(this.tamanho);
    this.escrita = 0;
    this.preenchido = 0;
    this.desdeUltima = 0;
    this.escutando = true;

    this.port.onmessage = ({ data }) => {
      if (!data) return;
      if (data.tipo === 'faixa') {
        this.detector.definirFaixa(data.minima, data.maxima);
      } else if (data.tipo === 'escutar') {
        // Ao voltar a escutar, o anel é descartado: ele ainda guarda o rabo do
        // som-guia que acabou de tocar, e detectar em cima disso faria o app
        // acreditar que a pessoa já cantou a nota certa.
        if (data.valor && !this.escutando) this.preenchido = 0;
        this.escutando = !!data.valor;
      }
    };
  }

  process(entradas) {
    const canal = entradas[0] && entradas[0][0];
    if (!canal) return true;

    for (let i = 0; i < canal.length; i++) {
      this.anel[this.escrita] = canal[i];
      this.escrita = (this.escrita + 1) % this.tamanho;
    }
    if (this.preenchido < this.tamanho) this.preenchido += canal.length;
    this.desdeUltima += canal.length;

    if (!this.escutando) return true;
    if (this.preenchido < this.tamanho) return true;
    if (this.desdeUltima < this.salto) return true;
    this.desdeUltima = 0;

    // O anel é circular; o detector espera tempo em ordem.
    const corte = this.tamanho - this.escrita;
    this.janela.set(this.anel.subarray(this.escrita), 0);
    this.janela.set(this.anel.subarray(0, this.escrita), corte);

    const leitura = this.detector.detectar(this.janela);
    this.port.postMessage({
      frequencia: leitura.frequencia,
      clareza: leitura.clareza,
      rms: leitura.rms,
      tempoAudio: currentTime,
    });

    return true;
  }
}

registerProcessor('detector-yin', ProcessadorYin);
