/* ============================================================
   MÓDULO CIENTÍFICO — Traducción ADN, %GC, proteínas, etc.
   ============================================================ */

const ScientificTools = (() => {
  'use strict';

  // --- Tabla de código genético estándar ---
  const CODON_TABLE = {
    'ATA':'I','ATC':'I','ATT':'I','ATG':'M',
    'ACA':'T','ACC':'T','ACG':'T','ACT':'T',
    'AAC':'N','AAT':'N','AAA':'K','AAG':'K',
    'AGC':'S','AGT':'S','AGA':'R','AGG':'R',
    'CTA':'L','CTC':'L','CTG':'L','CTT':'L',
    'CCA':'P','CCC':'P','CCG':'P','CCT':'P',
    'CAC':'H','CAT':'H','CAA':'Q','CAG':'Q',
    'CGA':'R','CGC':'R','CGG':'R','CGT':'R',
    'GTA':'V','GTC':'V','GTG':'V','GTT':'V',
    'GCA':'A','GCC':'A','GCG':'A','GCT':'A',
    'GAC':'D','GAT':'D','GAA':'E','GAG':'E',
    'GGA':'G','GGC':'G','GGG':'G','GGT':'G',
    'TCA':'S','TCC':'S','TCG':'S','TCT':'S',
    'TTC':'F','TTT':'F','TTA':'L','TTG':'L',
    'TAC':'Y','TAT':'Y','TAA':'*','TAG':'*',
    'TGC':'C','TGT':'C','TGA':'*','TGG':'W',
  };

  const STOP_CODONS = new Set(['TAA','TAG','TGA']);

  // --- Complemento ADN ---
  const DNA_COMP = { 'A':'T','T':'A','G':'C','C':'G','a':'t','t':'a','g':'c','c':'g' };

  // --- Masas moleculares de aminoácidos (g/mol) ---
  const AA_MASS = {
    'A': 89.09, 'R': 174.20, 'N': 132.12, 'D': 133.10,
    'C': 121.15, 'E': 147.13, 'Q': 146.15, 'G': 75.07,
    'H': 155.16, 'I': 131.17, 'L': 131.17, 'K': 146.19,
    'M': 149.21, 'F': 165.19, 'P': 115.13, 'S': 105.09,
    'T': 119.12, 'W': 204.23, 'Y': 181.19, 'V': 117.15,
    '*': 0, 'X': 110.0
  };

  // --- Escala GRAVY (Kyte-Doolittle) ---
  const GRAVY_SCALE = {
    'I': 4.5, 'V': 4.2, 'L': 3.8, 'F': 2.8, 'C': 2.5,
    'M': 1.9, 'A': 1.8, 'G': -0.4, 'T': -0.7, 'S': -0.8,
    'W': -0.9, 'Y': -1.3, 'P': -1.6, 'H': -3.2, 'E': -3.5,
    'Q': -3.5, 'D': -3.5, 'N': -3.5, 'K': -3.9, 'R': -4.5,
    '*': 0, 'X': 0
  };

  // --- pKa para punto isoeléctrico ---
  const PKA_NTERMINAL = { 'A': 7.59, 'R': 7.50, 'N': 7.50, 'D': 7.50, 'C': 7.50,
    'E': 7.70, 'Q': 7.50, 'G': 7.50, 'H': 7.50, 'I': 7.50,
    'L': 7.50, 'K': 7.50, 'M': 7.50, 'F': 7.50, 'P': 7.50,
    'S': 7.50, 'T': 7.50, 'W': 7.50, 'Y': 7.50, 'V': 7.50 };
  const PKA_CTERMINAL = { 'A': 2.34, 'R': 2.17, 'N': 2.02, 'D': 1.88, 'C': 1.96,
    'E': 2.19, 'Q': 2.17, 'G': 2.34, 'H': 1.82, 'I': 2.36,
    'L': 2.36, 'K': 2.18, 'M': 2.28, 'F': 2.58, 'P': 1.99,
    'S': 2.21, 'T': 2.09, 'W': 2.83, 'Y': 2.20, 'V': 2.32 };
  const PKA_SIDECHAIN = { 'R': 12.48, 'D': 3.65, 'C': 8.18, 'E': 4.25,
    'H': 6.00, 'K': 10.53, 'Y': 10.07, 'S': 13.00,
    'T': 13.00, 'N': 13.00, 'Q': 13.00 };

  // --- Validar secuencia ---
  function validateDNA(seq) {
    if (!seq || !seq.trim()) return 'La secuencia está vacía.';
    const clean = seq.replace(/[\s\d]/g, '').toUpperCase();
    if (!/^[ATCG]+$/.test(clean)) return 'Solo se permiten bases A, T, C, G (y espacios).';
    return null;
  }

  function validateProtein(seq) {
    if (!seq || !seq.trim()) return 'La secuencia está vacía.';
    const clean = seq.replace(/[\s\d]/g, '').toUpperCase();
    if (!/^[ARNDCQEGHILKMFPSTWYVX*]+$/.test(clean)) return 'Solo se permiten aminoácidos válidos (A-Z, *).';
    return null;
  }

  function cleanSeq(seq) {
    return seq.replace(/[\s\d]/g, '').toUpperCase();
  }

  // --- 1. Traducción ADN → Proteína ---
  function translate(sequence, frame = 1) {
    const err = validateDNA(sequence);
    if (err) return { error: err };

    const seq = cleanSeq(sequence);
    const results = [];
    const frames = frame === 0 ? [1, 2, 3, -1, -2, -3] : [frame];

    for (const f of frames) {
      let s, desc;
      if (f > 0) {
        s = seq.slice(f - 1);
        desc = `Marco +${f} (5′→3′, offset ${f-1}nt)`;
      } else {
        s = seq.split('').map(c => DNA_COMP[c.toUpperCase()] || c).reverse().join('');
        s = s.slice(Math.abs(f) - 1);
        desc = `Marco ${f} (3′→5′, complemento reverso, offset ${Math.abs(f)-1}nt)`;
      }

      let protein = '';
      for (let i = 0; i + 3 <= s.length; i += 3) {
        const codon = s.substring(i, i + 3);
        const aa = CODON_TABLE[codon] || 'X';
        protein += aa;
        if (STOP_CODONS.has(codon)) break;
      }

      results.push({ frame: f, description: desc, protein, length: protein.length });
    }

    return { results };
  }

  // --- 2. GC Content ---
  function gcContent(sequence) {
    const err = validateDNA(sequence);
    if (err) return { error: err };

    const seq = cleanSeq(sequence);
    const len = seq.length;
    if (len === 0) return { error: 'Secuencia vacía.' };

    const counts = { A: 0, T: 0, G: 0, C: 0 };
    for (const base of seq) {
      if (counts[base] !== undefined) counts[base]++;
    }

    const gcCount = counts.G + counts.C;
    const gcPercent = ((gcCount / len) * 100);
    const atPercent = ((counts.A + counts.T) / len * 100);

    // Temperatura de melting (fórmula básica, para cebadores)
    const tmBasic = (counts.A + counts.T) * 2 + (counts.G + counts.C) * 4;
    // Fórmula de Wallace corregida
    const tmWallace = 64.9 + 41 * (counts.G + counts.C - 16.4) / len;

    return {
      length: len,
      a: counts.A, t: counts.T, g: counts.G, c: counts.C,
      gcCount, gcPercent: +gcPercent.toFixed(2),
      atPercent: +atPercent.toFixed(2),
      tm: +tmWallace.toFixed(1),
      tmBasic: +tmBasic.toFixed(1),
    };
  }

  // --- 3. Reverse Complement ---
  function reverseComplement(sequence) {
    const err = validateDNA(sequence);
    if (err) return { error: err };

    const seq = cleanSeq(sequence);
    const revComp = seq.split('').map(c => DNA_COMP[c]).reverse().join('');
    return {
      original: seq,
      reverseComplement: revComp,
      length: seq.length,
    };
  }

  // --- 4. Analizar Proteína ---
  function analyzeProtein(sequence) {
    const err = validateProtein(sequence);
    if (err) return { error: err };

    const seq = cleanSeq(sequence);
    const len = seq.length;

    // Composición
    const composition = {};
    for (const aa of seq) {
      if (aa === '*' || aa === 'X') continue;
      composition[aa] = (composition[aa] || 0) + 1;
    }

    // Masa molecular (suma de masas - (n-1)*18.02 por pérdida de agua)
    let mass = 0;
    for (const aa of seq) {
      if (aa === '*') continue;
      mass += AA_MASS[aa] || AA_MASS['X'];
    }
    mass = mass - (len - 1) * 18.02;
    // + H2O en extremos
    mass = mass + 18.02;

    // GRAVY
    let gravySum = 0;
    let gravyCount = 0;
    for (const aa of seq) {
      if (aa === '*' || aa === 'X') continue;
      gravySum += GRAVY_SCALE[aa] || 0;
      gravyCount++;
    }
    const gravy = gravyCount > 0 ? +(gravySum / gravyCount).toFixed(3) : 0;

    // Composición porcentual
    const compPercent = {};
    for (const [aa, count] of Object.entries(composition)) {
      compPercent[aa] = +((count / len) * 100).toFixed(1);
    }

    // Aminoácidos ordenados por abundancia
    const sortedAA = Object.entries(compPercent)
      .sort((a, b) => b[1] - a[1])
      .map(([aa, pct]) => ({ aa, pct, count: composition[aa] }));

    return {
      length: len,
      mass: +mass.toFixed(2),
      massKDa: +(mass / 1000).toFixed(3),
      gravy,
      composition: sortedAA,
      sequence: seq,
    };
  }

  // --- 5. Cálculos de laboratorio ---

  // Molaridad: M = masa / (PM * volumen en L)
  function calcMolarity(mass, pm, volume, volUnit = 'L') {
    const volL = volUnit === 'mL' ? volume / 1000 : volUnit === 'µL' ? volume / 1e6 : volume;
    const moles = mass / pm;
    const molarity = moles / volL;
    return {
      moles: +moles.toExponential(4),
      molarity: +molarity.toExponential(4),
      molarityText: molarity >= 1 ? `${molarity.toFixed(3)} M` :
                    molarity >= 0.001 ? `${(molarity*1000).toFixed(3)} mM` :
                    `${(molarity*1e6).toFixed(3)} µM`,
    };
  }

  // Dilución: C1V1 = C2V2
  function calcDilution(c1, v1, c2, v2) {
    const known = [c1, v1, c2, v2].filter(x => x !== undefined && x !== null).length;
    if (known !== 3) return { error: 'Proporciona exactamente 3 de 4 valores (C1, V1, C2, V2).' };

    if (c1 === null || c1 === undefined) return { c1: (c2 * v2) / v1, formula: 'C1 = C2·V2 / V1' };
    if (v1 === null || v1 === undefined) return { v1: (c2 * v2) / c1, formula: 'V1 = C2·V2 / C1' };
    if (c2 === null || c2 === undefined) return { c2: (c1 * v1) / v2, formula: 'C2 = C1·V1 / V2' };
    if (v2 === null || v2 === undefined) return { v2: (c1 * v1) / c2, formula: 'V2 = C1·V1 / C2' };
  }

  // Conversión de unidades básica (científica)
  function convertUnit(value, from, to) {
    const units = {
      // Masa
      'kg': 1e3, 'g': 1, 'mg': 1e-3, 'µg': 1e-6, 'ng': 1e-9,
      'lb': 453.592, 'oz': 28.3495,
      // Volumen
      'L': 1, 'mL': 1e-3, 'µL': 1e-6, 'nL': 1e-9,
      'gal': 3.78541, 'floz': 0.0295735,
      // Concentración
      'M': 1, 'mM': 1e-3, 'µM': 1e-6, 'nM': 1e-9,
      'g/L': 1, 'mg/mL': 1, '%': 10,
      // Temperatura (manejo especial)
      '°C': 'celsius', '°F': 'fahrenheit', 'K': 'kelvin',
      // Energía
      'J': 1, 'kJ': 1000, 'cal': 4.184, 'kcal': 4184, 'eV': 1.602e-19,
    };

    // Temperatura
    if (from === '°C' || from === '°F' || from === 'K') {
      let celsius;
      if (from === '°C') celsius = value;
      else if (from === '°F') celsius = (value - 32) * 5/9;
      else celsius = value - 273.15;

      if (to === '°C') return +celsius.toFixed(2);
      if (to === '°F') return +(celsius * 9/5 + 32).toFixed(2);
      if (to === 'K') return +(celsius + 273.15).toFixed(2);
    }

    // Unidades normales (convertir a base y luego a destino)
    if (units[from] !== undefined && units[to] !== undefined) {
      const baseValue = value * units[from];
      const result = baseValue / units[to];
      return +result.toExponential(6);
    }

    return null;
  }

  // --- API pública ---
  return {
    translate,
    gcContent,
    reverseComplement,
    analyzeProtein,
    calcMolarity,
    calcDilution,
    convertUnit,
    validateDNA,
    validateProtein,
    cleanSeq,
    // Útil para mostrar tablas
    AA_NAMES: {
      'A':'Ala','R':'Arg','N':'Asn','D':'Asp','C':'Cys',
      'E':'Glu','Q':'Gln','G':'Gly','H':'His','I':'Ile',
      'L':'Leu','K':'Lys','M':'Met','F':'Phe','P':'Pro',
      'S':'Ser','T':'Thr','W':'Trp','Y':'Tyr','V':'Val',
    },
    AA_CLASS: {
      'A':'No polar','R':'Básico','N':'Polar','D':'Ácido','C':'Polar',
      'E':'Ácido','Q':'Polar','G':'No polar','H':'Básico','I':'No polar',
      'L':'No polar','K':'Básico','M':'No polar','F':'No polar','P':'No polar',
      'S':'Polar','T':'Polar','W':'No polar','Y':'Polar','V':'No polar',
    },
  };
})();
