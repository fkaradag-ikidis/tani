// ==========================================
// SEMPTOMDAN TANIYA - ANA ANALİZ ALGORİTMASI
// Dosya: algorithm.js
// ==========================================

// Global değişkenler (index.html ile paylaşılacak)
let diseaseDatabase = [];   // veritabani.js'den gelecek

/**
 * Ana Tanı Analiz Fonksiyonu
 */
function analyzeCase() {
    // 1. Hasta demografik verilerini al
    const age = parseInt(document.getElementById('patientAge').value);
    const gender = document.getElementById('patientGender').value;
    const weight = parseFloat(document.getElementById('patientWeight').value) || null;
    const height = parseFloat(document.getElementById('patientHeight').value) || null;

    // Zorunlu alan kontrolü
    if (!age && age !== 0) {
        alert('Lütfen hasta yaşını giriniz! (Yaş filtresi zorunludur)');
        document.getElementById('patientAge').focus();
        return;
    }
    if (!gender) {
        alert('Lütfen cinsiyet seçiniz! (Cinsiyet filtresi zorunludur)');
        document.getElementById('patientGender').focus();
        return;
    }

    // Anamnezden otomatik semptom çıkarımı (son kontrol)
    if (typeof extractSymptomsFromHistory === 'function') {
        extractSymptomsFromHistory();
    }

    // Hiç semptom seçilmediyse uyarı
    if (selectedSymptoms.length === 0) {
        if (!confirm('Hiç semptom seçilmedi. Sadece yaş/cinsiyet ve laboratuvar verilerine göre genel tarama yapılacak. Devam etmek istiyor musunuz?')) {
            return;
        }
    }

    // 2. Laboratuvar değerlerini topla
    const labs = {
        wbc: getLabValue('labWBC'), hgb: getLabValue('labHgb'), plt: getLabValue('labPlt'),
        mcv: getLabValue('labMCV'), crp: getLabValue('labCRP'), esr: getLabValue('labESR'),
        glucose: getLabValue('labGlu'), urea: getLabValue('labUrea'), creatinine: getLabValue('labCre'),
        ast: getLabValue('labAST'), alt: getLabValue('labALT'), alp: getLabValue('labALP'),
        bilirubin: getLabValue('labBil'), albumin: getLabValue('labAlb'), sodium: getLabValue('labNa'),
        potassium: getLabValue('labK'), calcium: getLabValue('labCa'), troponin: getLabValue('labTrop'),
        bnp: getLabValue('labBNP'), tsh: getLabValue('labTSH'), t4: getLabValue('labT4'),
        urineProtein: getLabValue('labProtein'), urineLeuko: getLabValue('labLeuko'),
        urineNitrit: getLabValue('labNitrit')
    };

    // 3. Yükleme ekranını göster
    document.getElementById('loadingSection').classList.add('active');
    document.getElementById('resultsSection').classList.remove('active');

    // 4. Analizi çalıştır (kısa gecikme ile UX iyileştirmesi)
    setTimeout(() => {
        const results = calculateDiagnosis(age, gender, labs);

        // Sonuçları göster
        displayResults(results);

        // Yükleme bitir
        document.getElementById('loadingSection').classList.remove('active');
        document.getElementById('resultsSection').classList.add('active');

        // Sonuçlara yumuşak kaydır
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 700);
}

/**
 * Gerçek skor hesaplama mantığı (temiz ayrılmış)
 */
function calculateDiagnosis(age, gender, labs) {
    const results = [];

    diseaseDatabase.forEach(disease => {
        // === 1. KATI FİLTRELER ===
        if (disease.ageRange) {
            if (age < disease.ageRange.min || age > disease.ageRange.max) return;
        }

        if (disease.gender && disease.gender !== 'both') {
            if (disease.gender !== gender) return;
        }

        // === 2. SEMPTOM SKORU (%50 ağırlık) ===
        let symptomScore = 0;
        let matchedSymptoms = [];
        let unmatchedSymptoms = [];

        if (disease.symptoms && disease.symptoms.length > 0) {
            matchedSymptoms = disease.symptoms.filter(s => selectedSymptoms.includes(s));
            unmatchedSymptoms = disease.symptoms.filter(s => !selectedSymptoms.includes(s));
            symptomScore = (matchedSymptoms.length / disease.symptoms.length) * 100;
        } else {
            symptomScore = 15; // semptom tanımlanmamış hastalıklar için düşük baz puan
        }

        // === 3. LABORATUVAR SKORU (%20 ağırlık) ===
        let labScore = calculateLabScore(disease, labs);

        // === 4. PREVALANS SKORU (%30 ağırlık) ===
        let prevalenceScore = getPrevalenceScore(disease.prevalence);

        // Yaş ve kategoriye göre küçük ayarlamalar
        if (disease.category === 'Kardiyovasküler' && age > 60) prevalenceScore += 12;
        if (disease.category === 'Pediatri' && age > 18) prevalenceScore = 5;

        // === 5. TOPLAM SKOR ===
        const totalScore = (symptomScore * 0.50) + (prevalenceScore * 0.30) + (labScore * 0.20);

        // Minimum eşik kontrolü
        if (totalScore > 15 || (disease.prevalence === 'high' && symptomScore > 20)) {
            results.push({
                disease: disease,
                totalScore: Math.min(100, totalScore),
                symptomScore: symptomScore,
                prevalenceScore: prevalenceScore,
                labScore: labScore,
                matchedSymptoms: matchedSymptoms,
                unmatchedSymptoms: unmatchedSymptoms,
                matchedLabs: [], // ileride genişletilebilir
                prevalenceLabel: disease.prevalence || 'medium'
            });
        }
    });

    // Skora göre sırala
    results.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return b.prevalenceScore - a.prevalenceScore;
    });

    return results;
}

/**
 * Laboratuvar skor hesaplama yardımcı fonksiyonu
 */
function calculateLabScore(disease, labs) {
    if (!disease.labs || Object.keys(disease.labs).length === 0) return 50;

    let totalWeight = 0;
    let matchedWeight = 0;

    Object.keys(disease.labs).forEach(key => {
        const labValue = labs[key];
        if (labValue === null || labValue === undefined) return;

        const condition = disease.labs[key];
        totalWeight += (condition.weight || 10);

        let isMatch = false;

        if (condition.type === 'high') {
            const ref = getLabReference(key);
            if (labValue > ref.max) isMatch = true;
        } else if (condition.type === 'low') {
            const ref = getLabReference(key);
            if (labValue < ref.min) isMatch = true;
        } else if (condition.type === 'range') {
            if (labValue >= condition.min && labValue <= condition.max) isMatch = true;
        } else if (condition.type === 'positive') {
            if (String(labValue).toLowerCase() === 'pozitif' || labValue === true) isMatch = true;
        }

        if (isMatch) matchedWeight += (condition.weight || 10);
    });

    return totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 50;
}

/**
 * Prevalans skor çevirici
 */
function getPrevalenceScore(prevalence) {
    switch (prevalence) {
        case 'high':  return 100;
        case 'medium': return 60;
        case 'low':   return 30;
        case 'rare':  return 10;
        default:      return 50;
    }
}

/**
 * Laboratuvar referans değerleri
 */
function getLabReference(id) {
    const refs = {
        'labWBC': { min: 4, max: 10, name: 'WBC' },
        'labHgb': { min: 12, max: 16, name: 'Hgb' },
        'labPlt': { min: 150, max: 400, name: 'Platelet' },
        'labCRP': { min: 0, max: 5, name: 'CRP' },
        'labESR': { min: 0, max: 20, name: 'ESR' },
        'labTrop': { min: 0, max: 0.014, name: 'Troponin' },
        // ... diğerleri eklenebilir
    };
    return refs[id] || { min: 0, max: 999, name: id };
}

/**
 * Laboratuvar değeri alma (mevcut HTML'deki fonksiyon)
 */
function getLabValue(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const val = el.value.trim();
    if (val === "") return null;

    if (el.tagName === 'SELECT') {
        return val === "" ? null : val;
    }

    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

// Sonuçları ekrana yazdırma (HTML ile uyumlu)
function displayResults(results) {
    const container = document.getElementById('diseaseList');
    container.innerHTML = '';

    if (results.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                <strong>Sonuç Bulunamadı</strong><br>
                Seçili semptomlar ve verilerle eşleşen hastalık bulunamadı.
            </div>`;
        return;
    }

    results.slice(0, 20).forEach((result, index) => {
        const item = document.createElement('div');
        item.className = `disease-item ${result.totalScore >= 70 ? 'high-probability' : 
                                      result.totalScore >= 40 ? 'medium-probability' : 
                                      result.prevalenceLabel === 'rare' ? 'rare' : 'low-probability'}`;

        // ... (displayResults içindeki HTML şablonu buraya kopyalanabilir)
        // İsterseniz tam HTML şablonunu da buraya koyabilirim.
        // Şimdilik yer tutucu:
        item.innerHTML = `
            <div class="disease-header">
                <div>
                    <span class="disease-name">${result.disease.name}</span>
                    <span class="disease-code">${result.disease.code || ''}</span>
                </div>
                <div style="text-align:right; font-size:1.4rem; font-weight:800; color:#2563eb;">
                    ${result.totalScore.toFixed(1)}%
                </div>
            </div>
            <div class="score-breakdown">
                <span>🩺 ${result.symptomScore.toFixed(0)}%</span>
                <span>📊 ${result.prevalenceScore.toFixed(0)}%</span>
                <span>🧪 ${result.labScore.toFixed(0)}%</span>
            </div>
        `;

        container.appendChild(item);
    });
}

// Public API (index.html'den çağırılacak)
window.analyzeCase = analyzeCase;