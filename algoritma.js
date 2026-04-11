/**
 * ============================================================
 * ALGORİTMA.JS — Semptomdan Tanıya Klinik Karar Destek Motoru
 * © 2024-2026 Dr. Feridun Karadağ — Tüm Hakları Saklıdır
 * VERSİYON: 2.2 — 2026-04-11
 * ============================================================
 */
console.log('✅ Algoritma v2.2 yüklendi');

// ==========================================
// ALGORİTMA YAPILANDIRMASI (Admin Panelinden Değiştirilebilir)
// ==========================================
let algorithmConfig = {
    weights: {
        symptom: 0.50,      // %50 Semptom uyumu
        prevalence: 0.30,   // %30 Prevalans
        lab: 0.20           // %20 Lab uyumu
    },
    thresholds: {
        minScore: 15,               // Listelenme için minimum skor
        highPrevalenceMinSymptom: 20, // Yüksek prevalanslı hastalık minimum semptom skoru
        maxResults: 20              // Gösterilecek maksimum sonuç
    },
    prevalenceScores: {
        high: 100,
        medium: 60,
        low: 30,
        rare: 10
    },
    genderFilters: {
        enabled: true,              // Cinsiyet filtresi etkin
        strictMode: true            // Kesin filtreleme (erkekte jinekoloji çıkmasın)
    },
    ageFilters: {
        enabled: true,              // Yaş filtresi etkin
        pediatricMaxAge: 18,        // Pediatrik hastalık üst yaş sınırı
        neonatalMaxAge: 1,          // Yenidoğan üst yaş sınırı
        geriatricMinAge: 65         // Geriatrik başlangıç yaşı
    },
    categoryRules: [
        // Özel kural: Erkekte jinekoloji tanısı çıkmasın
        { category: 'Jinekoloji', allowedGender: 'kadın', minAge: 0, maxAge: 120 },
        // Özel kural: Kadında üroloji (erkek spesifik) çıkmasın
        { category: 'Erkek Üroloji', allowedGender: 'erkek', minAge: 0, maxAge: 120 },
        // Özel kural: Pediatrik hastalıklar erişkinde çıkmasın
        { category: 'Pediatri', allowedGender: 'both', minAge: 0, maxAge: 18 },
        // Özel kural: Neonatal hastalıklar sadece yenidoğanda
        { category: 'Neonatal', allowedGender: 'both', minAge: 0, maxAge: 1 }
    ],
    prevalenceBonus: {
        // Yaşa göre prevalans bonusu
        cardiovascularOlderBonus: { minAge: 60, category: 'Kardiyovasküler', bonus: 10 },
        diabetesOlderBonus: { minAge: 45, category: 'Endokrin', bonus: 5 }
    }
};

// ==========================================
// SEMPTOM VERİTABANI (400+ Semptom - 13 Sistem)
// ==========================================
let symptomDatabase = {
    'GenelSistemik': [
        "Ateş", "Titreme (Rigor)", "Halsizlik", "Yorgunluk (Fatigue)", "Kilo kaybı (istemsiz)", "Kilo alma (hızlı)",
        "İştahsızlık (Anoreksi)", "Aşırı iştah (Hiperoreksi)", "Gece terlemesi", "Soğuk terleme", "Bilinç bulanıklığı",
        "Senkop (bayılma)", "Pre-syncope (bayılma hissi)", "Huzursuzluk", "Agitasyon", "Koma", "Letarji",
        "Pallor (Solukluk)", "Siyanoz (morluk)", "Ödem (bilateral)", "Lenfadenopati (büyümüş lenf nodu)",
        "Hepatomegali (büyümüş karaciğer)", "Splenomegali (büyümüş dalak)", "İntoksikasyon bulguları"
    ],
    'Enfeksiyon': [
        "Ateş (yüksek)", "Titreme", "Rigor (titreme atakları)", "Gece terlemesi (aşırı)", "İştahsızlık (akut)",
        "Halsizlik (akut)", "Farenjit (boğaz iltihabı)", "Boğaz ağrısı (Odynofaji)", "Öksürük (ürün)",
        "Balgam (yeşil-sarı)", "Balgam (kanlı)", "Nefes darlığı (dispne)", "Burun akıntısı (Rinore)",
        "Burun tıkanıklığı", "Sinüs ağrısı", "Kulak ağrısı (Otore)", "İshal (sulu)", "İshal (kanlı)",
        "Kusma (fekal)", "Karın ağrısı (kramplı)", "Dizüri (yanma)", "Sık idrara çıkma", "Cilt döküntüsü (maküler)",
        "Cilt döküntüsü (papüler)", "Petechia (noktasal kanama)", "Purpura (deri altı kanama)", "Eşimoz (morluk)",
        "Konjuktivit (göz iltihabı)", "Menenjeal irritasyon (ense sertliği)", "Beyin tutulumu belirtileri"
    ],
    'Kardiyovasküler': [
        "Göğüs ağrısı (baskı hissi)", "Göğüs ağrısı (kuşak tarzı)", "Precordial ağrı (göğüs kemiği arkası)",
        "Dispne (nefes darlığı)", "Efor dispnesi (yorgunluk nefes darlığı)", "Ortopne (yatarken nefes darlığı)",
        "Paroksismal nokturnal dispne (gece uyanan nefes darlığı)", "Yastık sayısı artışı",
        "Palpitasyon (kalp çarpıntısı)", "Çarpıntı", "Taşikardi (hızlı kalp)", "Bradikardi (yavaş kalp)",
        "Aritmi hissi (atım bozukluğu)", "Senkop (ani bayılma)", "Pre-syncope (baş dönmesi ile bayılma öncesi)",
        "Baş dönmesi (Vertigo)", "Hipotansiyon (düşük tansiyon)", "Hipertansiyon (yüksek tansiyon)",
        "Periferik ödem (ayak bileği şişliği)", "Anasarka (genel ödem)", "Akciğer ödemi bulguları",
        "Juguler ven distansiyonu (boyun damarı şişliği)", "Siyanoz (merkezi - dudak/morluk)",
        "Siyanoz (periferik - parmak ucu morluk)", "Klubing (tırnak şekli bozukluğu)",
        "Tromboflebit (damar iltihabı)", "Varis (damar genişlemesi)", "Egzersiz intoleransı", "Yorgunluk (kalp kaynaklı)"
    ],
    'Solunum': [
        "Öksürük (kuru)", "Öksürük (ürün - balgamlı)", "Öksürük (kanlı - Hemoptizi)", "Balgam (sarı-yeşil)",
        "Balgam (beyaz-köpüklü)", "Balgam (kanlı)", "Nefes darlığı (dispne)", "Efor dispnesi",
        "Dinlenme dispnesi", "Stridor (soluk sesi)", "Hışıltı (Wheezing)", "Ronkus (hırıltı)",
        "Krepitasyon (cırtlama)", "Göğüs ağrısı (pleuritik - nefesle artan)", "Taşipne (hızlı solunum)",
        "Bradipne (yavaş solunum)", "Apne (solunum durması)", "Kussmaul solunumu (derin-acidoz solunumu)",
        "Cheyne-Stokes solunumu (dalgalı)", "Siyanoz (dudak morluğu)", "Tırnaklarda morluk (hipoksi)",
        "Hipersantrasyon (derin solunum)", "Hipoventilasyon (sığ solunum)", "Gece öksürüğü",
        "Alerjik öksürük", "Sinek ötmesi (gırtlak ödemi)", "Ses kısıklığı", "Ağrılı yutkunma (Odynofaji)"
    ],
    'Sindirim': [
        "Bulantı (Nausea)", "Kusma (Emesis)", "Hematemez (kanlı kusma)", "Kahve telvesi görünümlü kusma",
        "İştahsızlık", "Erken doyma (Satiety)", "Epigastrik ağrı (mide üstü)", "Karın ağrısı (diffüz)",
        "Karın ağrısı (lokalize)", "Kramplı karın ağrısı (Kolik)", "Rebound tetikçiliği (eli çekince artan ağrı)",
        "Defans kasılması (kasın savunma refleksi)", "İshal (akut)", "İshal (kronik >4 hafta)",
        "Mukuslu ishal (balgamlı ishal)", "Kanlı ishal (Hematokezya)", "Siyah dışkı (Melena)",
        "Kabızlık (Konstipasyon)", "Dışkı tutamama (Fekal inkontinans)", "Tenismus (dışkı yapma zorluğu)",
        "Karın şişliği (Distansiyon)", "Asit (karın içi sıvı)", "Hepatomegali (karaciğer büyümesi)",
        "Splenomegali (dalak büyümesi)", "Sarılık (İkterus - cilt sararması)", "Sklera ikterus (göz akı sarılığı)",
        "Kaşıntı (kolestatik - safra kaynaklı)", "Koyu idrar (kolalı idrar)", "Acholia (beyaz kil gibi dışkı)",
        "Disfaji (yutma güçlüğü)", "Odynofaji (yutkunma ağrısı)", "Reflü (GERD)", "Ağız kokusu (Halitoz)",
        "Meteorizm (gaz şişkinliği)", "Safra kesesi ağrısı (sağ üst kadran)", "Pankreatik ağrı (şiddetli üst karın-sırt)"
    ],
    'Nöroloji': [
        "Baş ağrısı (Her türlü)", "Migren tarzı baş ağrısı (tek taraf, ataklı)", "Tansiyon baş ağrısı (band tarzı)",
        "Klastrofobik baş ağrısı (küme baş ağrısı)", "Baş dönmesi (Vertigo - dönme hissi)",
        "Baş dönmesi (Dizziness - hafif baygınlık)", "Senkop (bayılma)", "Dengesizlik (Ataksi)",
        "Konfüzyon (bilinç bulanıklığı)", "Bilinç değişikliği", "Koma (bilinç kapalılığı)",
        "Nöbet (Konvülsiyon)", "Tonik-klonik nöbet (sara nöbeti)", "Apsans nöbet (kısa dalgınlık)",
        "Parsiyel nöbet (fokal)", "Parestezi (uyuşma-karıncalanma)", "Uyuşma (Hiposteji)",
        "Karıncalanma (Tingling)", "Hiperestezi (aşırı duyarlılık)", "Güçsüzlük (parezi)",
        "Hemiparezi (tek taraf güçsüzlük)", "Paraparezi (bacak güçsüzlüğü)", "Tetraparezi (4 ekstremite güçsüzlüğü)",
        "Hemiplejia (tek taraf felç)", "Fasial paralizi (yüz felci)", "Bell paralizisi (periferik yüz felci)",
        "Diplopi (çift görme)", "Görme bulanıklığı", "Hemianopsi (yarım görme)", "Nistagmus (göz titremesi)",
        "Afazi (konuşma bozukluğu)", "Broca afazisi (anlayan ama konuşamayan)", "Dizartri (söyleniş bozukluğu)",
        "Disfaji (yutma güçlüğü)", "Romberg pozitifliği (göz kapalı dengesizlik)", "Babinski pozitifliği",
        "Menenjeal irritasyon (ense sertliği)", "Kernig işareti", "Brudzinski işareti",
        "Fotofobi (ışık korkusu)", "Fonofobi (ses korkusu)", "Rigidity (kas sertliği)"
    ],
    'Endokrin': [
        "Poliüri (çok idrar)", "Polidipsi (çok su içme)", "Polifaji (çok yeme)",
        "Kilo kaybı (aşırı iştahla birlikte)", "Soğuğa tahammülsüzlük", "Sıcağa tahammülsüzlük",
        "Terleme (Hiperhidroz)", "Aşırı terleme", "Hipertiroidi bulguları (gözlerde büyüme, el titremesi)",
        "Hipotiroidi bulguları (şişlik, yorgunluk)", "Guatr (boyun şişliği - tiroid)",
        "Tremor (el titremesi - ince)", "Kaba tremor (hipoglisemi tremoru)", "Taşikardi (tiroid kaynaklı)",
        "Bradikardi (hipotiroidi)", "Osteoporoz ağrısı (kemik ağrısı)", "Patolojik kırık (düşük enerjili kırık)",
        "Tiroid kaynaklı saç dökülmesi", "Galaktore (süt gelmesi-hamile değilken)",
        "Cinsel fonksiyon bozukluğu (ereksiyon bozukluğu)", "Libido değişikliği (cinsel istek)",
        "Gynecomastia (erkekte meme büyümesi)", "Hirsutism (kadında erkeksi kıllanma)",
        "Acanthosis nigricans (boyunda koyulaşma)", "Stria (karında çatlaklar)", "Obezite (metabolik)",
        "Hipoglisemi belirtileri (terleme, çarpıntı, açlık hissi)"
    ],
    'Romatoloji': [
        "Eklem ağrısı (Artaralji)", "Eklem şişliği (Artrit)", "Morning stiffness (sabah tutukluğu)",
        "Hareket kısıtlılığı (ROM kısıtlılığı)", "Kontraktür (sözleşme)", "Deformite (şekil bozukluğu)",
        "Krepitasyon (eklemden ses)", "Kas ağrısı (Miyalji)", "Kas güçsüzlüğü (Miyopati)",
        "Yaygın vücut ağrısı", "Fibromiyalji (yaygın ağrı + yorgunluk)", "Tetik noktalar",
        "Sırt ağrısı (Lomber)", "Bel ağrısı (Lumbago)", "Boyun ağrısı (Servikalji)",
        "Radiküler ağrı (sinir kökü ağrısı - kol/bacağa vuran)", "Nöropatik ağrı (yanıcı-batıcı)",
        "Enflamatuvar belirtiler (kızarıklık-sıcaklık)", "Eklem üzeri cilt kızarıklığı",
        "Romatoid nodül (dirsekte sert kitle)", "Heberden nodülü (el parmakları)",
        "Bouchard nodülü (el orta parmak eklemi)", "Sakroileit (bel omurgası ağrısı)",
        "Omurga tutulumu (sabitlik)", "Spondiloz (dejenerasyon)", "Skolyoz (yan eğrilik)", "Kifoz (kamburluk)"
    ],
    'Dermatoloji': [
        "Pruritus (Kaşıntı)", "Eritema (Kızarıklık)", "Makül (düz leke)", "Papül (kabarık leke)",
        "Vezikül (su kabarcığı)", "Büll (büyük su kabarcığı)", "Püstül (irinli kabarcık)",
        "Kabuk (Eroziyon üzeri)", "Erozyon (yüzeysel yara)", "Ülser (derin yara)",
        "Nekroz (doku ölümü-siyah)", "Skar (yara izi)", "Likenifikasyon (kalınlaşma)",
        "Maküler döküntü (düz kızarıklık)", "Papüler döküntü (kabarcıklı)", "Makulopapüler döküntü (karışık)",
        "Ürtiker (kurdeşen-beyaz kabarıklık)", "Anjiyödem (derin ödem-dudak/şişlik)", "Purpura (kanama)",
        "Petechia (nokta kanama)", "Eşimoz (morluk)", "Sarılık (cilt sararması)",
        "Hipopigmentasyon (beyazlaşma-Vitiligo)", "Hiperpigmentasyon (kararma-Melazma)",
        "Alopesia (saç dökülmesi)", "Onikoliz (tırnak ayrılması)", "Onikomikoz (tırnak mantarı)",
        "Psoriazis (sedef-kırmızı gümüş)", "Liken planus (düz liken-mor papül)",
        "Akne (sivilce)", "Rosacea (gül hastalığı)", "Furunkül (çıban)", "Selülit (cilt altı iltihabı)"
    ],
    'Üroloji': [
        "Dizüri (yanma-idrar yaparken ağrı)", "Ağrılı idrar", "Pollaküri (sık idrara çıkma)",
        "Acil idrar hissi (Urjansi)", "Ürge inkontinans (tutamama-tuvalete yetişememe)",
        "Stres inkontinansı (öksürünce kaçırma)", "Totale inkontinans (sürekli kaçırma)",
        "Noktüri (gece idrara kalkma)", "Poliüri (çok idrar miktarı)", "Oligüri (az idrar)",
        "Anüri (idrar yokluğu)", "Hesitans (idrar başlatma güçlüğü)", "İdrar akımında zayıflık",
        "Damlama (idrar sonrası damlama)", "Üretral akıntı", "Hematuri (kanlı idrar)",
        "Kolik ağrı (böbrek taşı ağrısı-dalga dalga)", "Flank ağrısı (bel yan taraf ağrısı)",
        "Suprapubik ağrı (kasık üstü ağrı)", "Akut idrar retansiyonu (idrar yapamama)",
        "Prostat ağrısı (perende arası)", "Erektil disfonksiyon (sertleşme bozukluğu)",
        "Epididim ağrısı (testis üstü)", "Orşit (testis iltihabı)", "Orkialji (testis ağrısı)",
        "Skrotal şişlik (torbada şişlik)", "Hidrosel (torbada su toplanması)"
    ],
    'Jinekoloji': [
        "Vajinal akıntı (flor)", "Flor değişikliği (renk-koku)", "Vajinit (vajina iltihabı)",
        "Servisit (rahim ağzı iltihabı)", "Vulvar kaşıntı (dış genital kaşıntı)",
        "Vajinal kuruluk (menopoz öncesi/sonrası)", "Disparöni (cinsel ilişki ağrısı)",
        "Postkoital kanama (ilişki sonrası kanama)", "Menstrüel düzensizlik", "Menoraji (ağır adet)",
        "Metroraji (düzensiz ara kanama)", "Dismenore (ağrılı adet-kramp)", "Amenore (adet görmeme)",
        "Oligomenore (seyrek adet)", "Polimenore (sık adet)", "Premenstrual sendrom (PMS)",
        "Pelvik ağrı (alt karın ağrısı)", "Kronik pelvik ağrı", "Ovulasyon ağrısı (Mittelschmerz)",
        "Lekelenme (Spotting-ara kanama)", "Menopoz semptomları (sıcak basması)", "Gece terlemesi (menopozal)",
        "Libido değişikliği (cinsel istek azalması/artması)", "İnfertilite (kısırlık)",
        "Düşük tehdidi (vajinal kanama-karın ağrısı-gebelikte)", "Gebelik bulantısı (Hyperemesis gravidarum)",
        "Gebelik hipertansiyonu (preeklampsi)", "Gestasyonel diyabet (gebelik şekeri)"
    ],
    'Psikiyatri': [
        "Anksiyete (kaygı)", "Endişe", "Panik atak (ani korku-palpitesyon)", "Panik bozukluk",
        "Fobi (korku)", "Sosyal fobi (toplum içi korku)", "Agorafobi (dışarı çıkma korkusu)",
        "Obsesyon (takıntı düşünce)", "Kompulsiyon (takıntı davranış-tekrarlama)", "OCD (obsesif-kompulsif)",
        "Tik (motor-ses)", "Depresyon (Major depresif epizod)", "Mutsuzluk (Persistent)", "Anhedonia (zevk alamama)",
        "Umutsuzluk", "Değersizlik hissi", "Suçluluk hissi (aşırı)", "Psikomotor retardasyon (yavaşlama)",
        "Psikomotor ajitasyon (hareketlilik)", "İnsomnia (uyuyamama)", "Uyku bozukluğu", "Uykuya dalamama",
        "Erken uyanma (depresif)", "Hipersonnia (aşırı uyuma)", "Kabus (Rüya)", "Gece terörü (Night terror)",
        "Manik bulgular (kıpır kıpırlık)", "Efori (aşırı keyif)", "Huzursuzluk (manik)",
        "Halüsinasyon (sanrı duyu)", "İşitsel halüsinasyon (ses duyma)", "Görsel halüsinasyon (görme)",
        "Sanrı (Delusion)", "Perseküsyon sanrısı (zarar verme sanrısı)", "Demans bulguları (bellek kaybı)",
        "Anterograde amnezi (yeni öğrenememe)", "Retrograde amnezi (geçmişi hatırlayamama)",
        "Anoreksia nervosa (aşırı zayıflama-korku)", "Bulimia nervosa (tıkınıp çıkarma)",
        "Madde kullanımı bağımlılığı", "Yoksunluk bulguları (withdrawal)", "İntihar düşüncesi (Suisid ideasyon)",
        "Agresiflik (saldırganlık)", "Impulsivite (dürtüsellik)", "Dikkat dağınıklığı (Attention deficit)",
        "Hiperaktivite (Hyperactivity)"
    ],
    'Hematoloji': [
        "Pallor (cilt solukluğu)", "Yorgunluk (Kronik anemi)", "Halsizlik (ağır anemi)",
        "Baş dönmesi (pozisyonel-anemi)", "Senkop (anemik)", "Dispne (nefes darlığı-anemi)",
        "Angina (göğüs ağrısı-anemik)", "Takikardi (kalp çarpıntısı-dengeleme)", "Peteşia (ciltte nokta kanama)",
        "Purpura (deri altı kanamalar)", "Eşimoz (morluklar)", "Epistaksis (burun kanaması-tekrarlayan)",
        "Gingival kanama (diş eti kanaması)", "Hemoptizi (kanlı balgam-koagülopati)", "Melena (siyah dışkı)",
        "Hematokezya (dışkıda kan)", "Hematuri (idrar kanı)", "Menoraji (aşırı adet kanaması)",
        "Hemartroz (eklem içi kanama)", "Spontan hematom (nedensiz morluk)", "Enjeksiyon yerinde aşırı kanama",
        "Gece terlemesi (hematolojik-lenfoma)", "Kilo kaybı (hematolojik)", "Lenfadenopati (genelleşmiş)",
        "Hepatosplenomegali (karaciğer-dalak büyümesi)", "Kemik ağrısı (sternum-tibia)",
        "Sternal hassasiyet (kemik iliği basıncı)", "Pika (anormal yeme-toprak-kil)", "Pagofaji (buz yeme-demir eksikliği)"
    ]
};

// ==========================================
// GLOBAL DURUM DEĞİŞKENLERİ
// ==========================================
let selectedSymptoms = [];
let diseaseDatabase = [];

// ==========================================
// VERİTABANI BAŞLATMA
// ==========================================

function initDiseaseDatabase() {
    // 1. Önce localStorage'dan admin panelinin kaydettiği diff'i uygula
    let adminDiff = null;
    try {
        const saved = localStorage.getItem('adminDiseaseDB');
        if (saved) adminDiff = JSON.parse(saved);
    } catch(e) {}

    // 2. Tüm yüklü veritabanı değişkenlerini topla
    const ALL_DB_VARS = [
        'diseaseDB_romatoloji', 'diseaseDB_enfeksiyon', 'diseaseDB_onkoloji',
        'diseaseDB_hematoloji', 'diseaseDB_endokrin', 'diseaseDB_kardiyoloji',
        'diseaseDB_gogus', 'diseaseDB_gastro', 'diseaseDB_nefroloji',
        'diseaseDB_noroloji', 'diseaseDB_psikiyatri', 'diseaseDB_dermatoloji',
        'diseaseDB_kadin_dogum', 'diseaseDB_cocuk', 'diseaseDB_goz',
        'diseaseDB_kbb', 'diseaseDB_uroloji', 'diseaseDB_ortopedi',
        'diseaseDB_travma', 'diseaseDB_allerji', 'diseaseDB_geriatri',
        'diseaseDB_genel_cerrahi', 'diseaseDB_kvc', 'diseaseDB_genetik',
        'diseaseDB_sendrom',
        // Eski tek dosya formatı (geriye dönük uyumluluk)
        'diseaseDB', 'diseaseDB2'
    ];

    let allDiseases = [];
    let loadedDBCount = 0;

    ALL_DB_VARS.forEach(varName => {
        try {
            // var ile tanımlanan değişkenler window'a bağlanır (const bağlanmaz)
            // İkisi de dene: window[varName] ve doğrudan eval
            let db = window[varName];
            if (!db) {
                try { db = eval(varName); } catch(e2) {}
            }
            if (db && db.diseases && db.diseases.length > 0) {
                allDiseases = allDiseases.concat(db.diseases.map(transformRawDisease));
                loadedDBCount++;
            }
        } catch(e) {}
    });

    // Eski tek dosya: `const diseaseDB` window'a bağlanmaz, direkt erişim dene
    if (loadedDBCount === 0) {
        try {
            if (typeof diseaseDB !== 'undefined' && diseaseDB.diseases) {
                allDiseases = diseaseDB.diseases.map(transformRawDisease);
                loadedDBCount++;
            }
        } catch(e) {}
    }

    if (allDiseases.length > 0) {
        // Admin diff'ini uygula (silinen/değiştirilen kayıtlar)
        if (adminDiff) {
            const deleted = adminDiff.deleted || {};
            const modified = adminDiff.modified || {};
            const added = (adminDiff.added || []).map(transformRawDisease);

            allDiseases = allDiseases.filter(d => !deleted[d.code]);
            allDiseases = allDiseases.map(d => modified[d.code] ? transformRawDisease(modified[d.code]) : d);
            allDiseases = allDiseases.concat(added);
        }
        diseaseDatabase = allDiseases;
        console.log(`✅ Hastalık DB yüklendi: ${diseaseDatabase.length} hastalık (${loadedDBCount} veritabanı dosyası)`);
        return;
    }

    // 3. Fallback: Temel örnek veri
    console.warn('⚠️ Hiçbir veritabanı dosyası yüklenemedi. Örnek veriler kullanılıyor.');
    diseaseDatabase = getFallbackDiseases();
}

function transformRawDisease(raw) {
    // veritabani.js formatını algoritma formatına dönüştür
    const prevalenceMap = determinePrevalence(raw.category);
    const genderMap = determineGender(raw.name, raw.category);
    const ageRange = determineAgeRange(raw.category, raw.name);

    return {
        code: raw.id || ('NEW' + Math.random().toString(36).substr(2, 6).toUpperCase()),
        name: raw.name || 'İsimsiz Hastalık',
        englishName: raw.englishName || '',
        category: raw.category || 'Genel',
        subcategory: raw.subcategory || '',
        prevalence: raw.prevalence || prevalenceMap,
        symptoms: raw.symptoms || [],
        signs: raw.signs || [],
        labFindings: raw.labFindings || [],
        labs: transformLabFindings(raw.labFindings || []),
        pathology: raw.pathology || [],
        radiology: raw.radiology || [],
        pathologyNotes: (raw.pathology || []).join('; '),
        radiologyNotes: (raw.radiology || []).join('; '),
        ageRange: ageRange,
        gender: raw.gender || genderMap,
        course: raw.course || '',
        complications: raw.complications || [],
        treatment: raw.treatment || []
    };
}

function determinePrevalence(category) {
    const highPrevalence = ['Kardiyovasküler Hastalıklar', 'Endokrin Hastalıklar', 'Sindirim Sistemi Hastalıkları'];
    const lowPrevalence = ['Neoplazmalar', 'Metabolik Hastalıklar'];
    if (highPrevalence.some(c => category && category.includes(c.split(' ')[0]))) return 'high';
    if (lowPrevalence.some(c => category && category.includes(c.split(' ')[0]))) return 'low';
    return 'medium';
}

function determineGender(name, category) {
    const femaleKeywords = ['Jinekoloji', 'Gebelik', 'Doğum', 'Menstrüal', 'Vajinal', 'Servikal', 'Uterin', 'Oofer', 'Tubal'];
    const maleKeywords = ['Prostat', 'Testis', 'Erkek', 'Penis', 'Epididim'];
    const nameLower = (name || '').toLowerCase();
    const catLower = (category || '').toLowerCase();
    if (femaleKeywords.some(k => nameLower.includes(k.toLowerCase()) || catLower.includes(k.toLowerCase()))) return 'kadın';
    if (maleKeywords.some(k => nameLower.includes(k.toLowerCase()) || catLower.includes(k.toLowerCase()))) return 'erkek';
    return 'both';
}

function determineAgeRange(category, name) {
    const nameLower = (name || '').toLowerCase();
    const catLower = (category || '').toLowerCase();
    if (catLower.includes('neonatal') || nameLower.includes('yenidoğan') || nameLower.includes('konjenital')) {
        return { min: 0, max: 1 };
    }
    if (catLower.includes('pediatri') || nameLower.includes('çocuk') || nameLower.includes('infantil')) {
        return { min: 0, max: 18 };
    }
    if (nameLower.includes('erişkin')) {
        return { min: 18, max: 120 };
    }
    return { min: 0, max: 120 };
}

function transformLabFindings(labFindings) {
    const labs = {};
    // Basit eşleşme sözlüğü
    const labKeywords = {
        'wbc': ['lökositoz', 'lökopeni', 'wbc', 'lökosit'],
        'hgb': ['hemoglobin', 'anemi', 'hgb', 'hb'],
        'plt': ['trombositopeni', 'trombositoz', 'platelet', 'trombosit'],
        'crp': ['crp', 'c-reaktif'],
        'esr': ['sedimentasyon', 'esr'],
        'glucose': ['hiperglisemi', 'hipoglisemi', 'glukoz', 'kan şekeri'],
        'creatinine': ['kreatinin', 'böbrek yetmezliği'],
        'ast': ['ast', 'transaminaz'],
        'alt': ['alt', 'transaminaz'],
        'bilirubin': ['bilirubin', 'sarılık', 'ikter'],
        'troponin': ['troponin'],
        'bnp': ['bnp', 'nt-probnp'],
        'tsh': ['tsh', 'tiroit', 'tiroid']
    };

    labFindings.forEach(finding => {
        const findingLower = finding.toLowerCase();
        Object.keys(labKeywords).forEach(labKey => {
            if (labKeywords[labKey].some(kw => findingLower.includes(kw))) {
                if (!labs[labKey]) {
                    const isHigh = findingLower.includes('yüksek') || findingLower.includes('artmış') ||
                        findingLower.includes('elevated') || findingLower.includes('+');
                    const isLow = findingLower.includes('düşük') || findingLower.includes('azalmış') ||
                        findingLower.includes('peni');
                    labs[labKey] = {
                        type: isHigh ? 'high' : isLow ? 'low' : 'high',
                        weight: 15,
                        name: labKey.toUpperCase()
                    };
                }
            }
        });
    });
    return labs;
}

function getFallbackDiseases() {
    // KASITLI OLARAK BOŞ — yedek liste yanlış tanı üretir
    // Veritabanı yüklenemezse boş liste döndür, kullanıcıyı bilgilendir
    console.error('❌ Hiçbir veritabanı dosyası yüklenemedi! Lütfen tüm veritabani_*.js dosyalarının sitede olduğunu kontrol edin.');
    return [];
}

// ==========================================
// ALGORİTMA AYARLARI YÜKLEME
// ==========================================

function initAlgorithmConfig() {
    try {
        const saved = localStorage.getItem('adminAlgorithmConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Deep merge
            algorithmConfig = deepMerge(algorithmConfig, parsed);
            console.log('✅ Algoritma ayarları localStorage\'dan yüklendi');
        }
    } catch (e) {
        console.warn('Algoritma config yükleme hatası:', e);
    }
}

function deepMerge(target, source) {
    const result = { ...target };
    Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    });
    return result;
}

// ==========================================
// BAŞLATMA
// ==========================================

function initApp() {
    initAlgorithmConfig();
    initDiseaseDatabase();
    renderSymptoms('GenelSistemik');
    updateBMICalculation();
    setInterval(updateBMICalculation, 1000);
}

// ==========================================
// BMI & HASTA VERİSİ
// ==========================================

function updateBMICalculation() {
    const height = parseFloat(document.getElementById('patientHeight')?.value);
    const weight = parseFloat(document.getElementById('patientWeight')?.value);
    const bmiInput = document.getElementById('patientBMI');
    if (height && weight && height > 0 && weight > 0) {
        const heightM = height / 100;
        const bmi = (weight / (heightM * heightM)).toFixed(1);
        let category = '';
        if (bmi < 18.5) category = ' (Zayıf)';
        else if (bmi < 25) category = ' (Normal)';
        else if (bmi < 30) category = ' (Kilolu)';
        else category = ' (Obez)';
        bmiInput.value = bmi + category;
    } else {
        bmiInput.value = '';
    }
}

function validateAge() {
    const age = parseInt(document.getElementById('patientAge').value);
    if (age < 0 || age > 120) {
        alert('Geçerli bir yaş giriniz (0-120 arası)');
        document.getElementById('patientAge').value = '';
    }
}

function validateGender() {
    updateSelectedSymptoms();
}

// ==========================================
// SEMPTOM YÖNETİMİ
// ==========================================

function renderSymptoms(system) {
    const container = document.getElementById('symptomContainer');
    container.innerHTML = '';
    const symptoms = symptomDatabase[system] || [];
    symptoms.forEach((symptom, index) => {
        const div = document.createElement('div');
        div.className = 'symptom-item';
        if (selectedSymptoms.includes(symptom)) div.classList.add('selected');
        div.textContent = symptom;
        div.onclick = () => toggleSymptom(symptom);
        div.style.animationDelay = `${index * 0.01}s`;
        container.appendChild(div);
    });
    document.getElementById('currentSystem').textContent = system.replace(/([A-Z])/g, ' $1').trim();
}

function toggleSymptom(symptom) {
    const index = selectedSymptoms.indexOf(symptom);
    if (index > -1) {
        selectedSymptoms.splice(index, 1);
    } else {
        selectedSymptoms.push(symptom);
    }
    updateSelectedSymptoms();
    renderSymptoms(document.querySelector('.system-tab.active')?.dataset?.system || 'GenelSistemik');
}

function updateSelectedSymptoms() {
    const container = document.getElementById('selectedSymptoms');
    const count = document.getElementById('selectedCount');
    count.textContent = selectedSymptoms.length;
    if (selectedSymptoms.length === 0) {
        container.innerHTML = '<span style="color: var(--secondary); font-size: 0.875rem; padding: 0.5rem;">Henüz semptom seçilmedi. Yukarıdan seçim yapın veya anamnez yazın...</span>';
        return;
    }
    container.innerHTML = selectedSymptoms.map(s => `
        <span class="symptom-tag">
            ${s}
            <span class="remove-tag" onclick="event.stopPropagation(); removeSelectedSymptom('${s.replace(/'/g, "\\'")}')">×</span>
        </span>
    `).join('');
}

function removeSelectedSymptom(symptom) {
    const index = selectedSymptoms.indexOf(symptom);
    if (index > -1) {
        selectedSymptoms.splice(index, 1);
        updateSelectedSymptoms();
        renderSymptoms(document.querySelector('.system-tab.active')?.dataset?.system || 'GenelSistemik');
    }
}

function clearAllSymptoms() {
    selectedSymptoms = [];
    updateSelectedSymptoms();
    renderSymptoms(document.querySelector('.system-tab.active')?.dataset?.system || 'GenelSistemik');
}

function switchSystem(system) {
    document.querySelectorAll('.system-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent === getSystemLabel(system)) {
            tab.classList.add('active');
            tab.dataset.system = system;
        }
    });
    renderSymptoms(system);
}

function getSystemLabel(system) {
    const labels = {
        'GenelSistemik': 'Genel', 'Enfeksiyon': 'Enfeksiyon', 'Kardiyovasküler': 'Kardiyovasküler',
        'Solunum': 'Solunum', 'Sindirim': 'Sindirim', 'Nöroloji': 'Nöroloji',
        'Endokrin': 'Endokrin', 'Romatoloji': 'Romatoloji', 'Dermatoloji': 'Dermatoloji',
        'Üroloji': 'Üroloji', 'Jinekoloji': 'Jinekoloji', 'Psikiyatri': 'Psikiyatri', 'Hematoloji': 'Hematoloji'
    };
    return labels[system] || 'Genel';
}

function filterSymptoms() {
    const search = document.getElementById('symptomSearch').value.toLowerCase().trim();
    const activeSystem = document.querySelector('.system-tab.active')?.dataset?.system || 'GenelSistemik';
    const container = document.getElementById('symptomContainer');
    container.innerHTML = '';
    let symptomsToShow = [];
    if (search.length > 0) {
        Object.keys(symptomDatabase).forEach(system => {
            const matches = symptomDatabase[system].filter(s => s.toLowerCase().includes(search));
            symptomsToShow = [...symptomsToShow, ...matches];
        });
    } else {
        symptomsToShow = symptomDatabase[activeSystem] || [];
    }
    symptomsToShow = [...new Set(symptomsToShow)];
    if (symptomsToShow.length === 0) {
        container.innerHTML = '<div class="empty-state">Eşleşen semptom bulunamadı</div>';
        return;
    }
    symptomsToShow.forEach(symptom => {
        const div = document.createElement('div');
        div.className = 'symptom-item';
        if (selectedSymptoms.includes(symptom)) div.classList.add('selected');
        div.textContent = symptom;
        div.onclick = () => toggleSymptom(symptom);
        container.appendChild(div);
    });
}

function showTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// ==========================================
// ANAMNEZ ANALİZİ (METİNDEN SEMPTOM ÇIKARIMI)
// ==========================================

function extractSymptomsFromHistory() {
    const text = document.getElementById('patientHistory').value.toLowerCase();
    if (!text || text.length < 3) return;
    const foundSymptoms = [];
    const allSymptoms = Object.values(symptomDatabase).flat();

    allSymptoms.forEach(symptom => {
        // Sadece semptomun temel kısmını (parantez öncesi) ara
        const base = symptom.toLowerCase().split('(')[0].trim();
        if (base.length < 4) return;
        // Kelime sınırı kontrolü: "ödem" aranırken "ödemli" veya "ödematöz" bulunmasın
        // ama "yaygın ödem var" bulunabilsin
        const regex = new RegExp('(?:^|\\s|,|;|\\.)' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|,|;|\\.|$)', 'i');
        if (regex.test(text)) foundSymptoms.push(symptom);
    });

    const synonymMap = {
        'baş ağrısı': ['başım ağrıyor', 'baş ağrısı', 'migren', 'şiddetli baş ağrısı'],
        'göğüs ağrısı': ['göğsümde ağrı', 'göğüs ağrısı', 'kalbimde ağrı', 'göğsümde baskı'],
        'nefes darlığı': ['nefes darlığı', 'soluk soluğa kalma', 'nefesim yetmiyor', 'dispne'],
        'karın ağrısı': ['karın ağrısı', 'karnımda ağrı', 'göbek ağrısı', 'batında ağrı'],
        'bulantı': ['bulantı', 'midem bulanıyor', 'kusma hissi', 'mide bulantısı'],
        'ateş': ['ateş', 'ateşim var', 'titreme', 'harpasız ateş'],
        'öksürük': ['öksürük', 'öksürüyorum', 'balgam', 'kuru öksürük'],
        'kanama': ['kanama', 'kanıyor', 'kanlı', 'kan geliyor']
    };
    for (const [canonical, synonyms] of Object.entries(synonymMap)) {
        if (synonyms.some(s => text.includes(s))) {
            // Tam kelime eşleşmesi ile semptom bul
            const fullSymptom = allSymptoms.find(s => {
                const base = s.toLowerCase().split('(')[0].trim();
                return base === canonical || base.startsWith(canonical);
            });
            if (fullSymptom && !foundSymptoms.includes(fullSymptom)) foundSymptoms.push(fullSymptom);
        }
    }
    let newAdded = 0;
    foundSymptoms.forEach(sym => {
        if (!selectedSymptoms.includes(sym)) {
            selectedSymptoms.push(sym);
            newAdded++;
        }
    });
    if (newAdded > 0) {
        updateSelectedSymptoms();
        renderSymptoms(document.querySelector('.system-tab.active')?.dataset?.system || 'GenelSistemik');
    }
}

// ==========================================
// LABORATUVAR DEĞERLERİ
// ==========================================

function getLabValue(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const val = el.value;
    if (val === "" || val === null || val === undefined) return null;
    if (el.tagName === 'SELECT') return val === "" ? null : val;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

function getLabReference(id) {
    const refs = {
        'labWBC': { min: 4, max: 10, name: 'WBC' },
        'labHgb': { min: 12, max: 16, name: 'Hgb' },
        'labPlt': { min: 150, max: 400, name: 'Platelet' },
        'labMCV': { min: 80, max: 100, name: 'MCV' },
        'labCRP': { min: 0, max: 5, name: 'CRP' },
        'labESR': { min: 0, max: 20, name: 'ESR' },
        'labGlu': { min: 70, max: 100, name: 'Glukoz' },
        'labUrea': { min: 10, max: 50, name: 'Üre' },
        'labCre': { min: 0.6, max: 1.2, name: 'Kreatinin' },
        'labAST': { min: 0, max: 40, name: 'AST' },
        'labALT': { min: 0, max: 40, name: 'ALT' },
        'labALP': { min: 40, max: 130, name: 'ALP' },
        'labBil': { min: 0.3, max: 1.2, name: 'Bilirubin' },
        'labAlb': { min: 3.5, max: 5.0, name: 'Albumin' },
        'labNa': { min: 135, max: 145, name: 'Sodyum' },
        'labK': { min: 3.5, max: 5.0, name: 'Potasyum' },
        'labCa': { min: 8.5, max: 10.5, name: 'Kalsiyum' },
        'labTrop': { min: 0, max: 0.014, name: 'Troponin' },
        'labBNP': { min: 0, max: 100, name: 'BNP' },
        'labTSH': { min: 0.4, max: 4.0, name: 'TSH' },
        'labT4': { min: 0.8, max: 1.8, name: 'T4' }
    };
    return refs[id] || { min: 0, max: 999, name: id };
}

// ==========================================
// ANA TANISAL ALGORİTMA
// ==========================================

function analyzeCase() {
    const age = parseInt(document.getElementById('patientAge').value);
    const gender = document.getElementById('patientGender').value;
    const weight = parseFloat(document.getElementById('patientWeight').value) || null;
    const height = parseFloat(document.getElementById('patientHeight').value) || null;
    const imagingResults = document.getElementById('imagingResults')?.value || '';
    const pathologyResults = document.getElementById('pathologyResults')?.value || '';
    const labResults = document.getElementById('labResults')?.value || '';

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
    extractSymptomsFromHistory();
    if (selectedSymptoms.length === 0) {
        alert('⚠️ Lütfen en az bir semptom seçiniz.\n\nSemptom olmadan güvenilir tanı üretmek mümkün değildir. Semptomları seçtikten sonra lab ve seroloji verilerini de ekleyebilirsiniz.');
        return;
    }

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

    document.getElementById('loadingSection').classList.add('active');
    document.getElementById('resultsSection').classList.remove('active');

    setTimeout(() => {
        const results = [];
        const cfg = algorithmConfig;

        diseaseDatabase.forEach(disease => {

            // ── A. YAŞ KONTROLÜ (KATI) ──────────────────────────
            if (cfg.ageFilters.enabled && disease.ageRange) {
                if (age < disease.ageRange.min || age > disease.ageRange.max) return;
            }

            // ── B. CİNSİYET KONTROLÜ (KATI) ──────────────────────
            if (cfg.genderFilters.enabled && disease.gender && disease.gender !== 'both') {
                if (disease.gender !== gender) return;
            }

            // ── B2. KATEGORİ KURALLARI ────────────────────────────
            if (cfg.categoryRules && cfg.categoryRules.length > 0) {
                for (const rule of cfg.categoryRules) {
                    if (disease.category && disease.category.includes(rule.category)) {
                        if (rule.allowedGender !== 'both' && rule.allowedGender !== gender) return;
                        if (age < rule.minAge || age > rule.maxAge) return;
                    }
                }
            }

            // ── C. SEMPTOM SKORU (%50) ────────────────────────────
            let symptomScore = 0;
            let matchedSymptoms = [];
            let unmatchedSymptoms = [];

            // Hem symptoms[] hem signs[] ile eşleştir
            const diseaseSymptoms = [...(disease.symptoms || []), ...(disease.signs || [])];

            if (diseaseSymptoms.length > 0) {

                // ── AKILLI SEMPTOM EŞLEŞTİRME ─────────────────────────
                // Sorun: "yaygın ödem".includes("yaygın") → "yaygın eritem" de eşleşiyordu
                // Çözüm: anlamlı kök kelimeleri çıkar, hem seçilen hem hastalık semptomunu karşılaştır

                function extractKeywords(symptomStr) {
                    // Parantez içini çıkar ve temizle: "Ödem (bilateral alt ext)" → ["ödem", "bilateral", "alt"]
                    const lower = symptomStr.toLowerCase();
                    // Kısa ve anlamsız kelimeleri filtrele
                    const stopWords = new Set(['ve', 'ile', 'veya', 'bir', 'bu', 'da', 'de', 'mi', 'mu', 'mü', 'ya', 'ya', 'ki', 'ise', 'için', 'gibi', 'kadar', 'sonra', 'önce', 'olan', 'olur', 'olması', 'the', 'and', 'or', 'of', 'in', 'at']);
                    return lower
                        .replace(/[()[\]\/\-,.;:]/g, ' ')
                        .split(/\s+/)
                        .filter(w => w.length >= 4 && !stopWords.has(w));
                }

                function symptomMatch(selected, diseaseSymptom) {
                    const selLow  = selected.toLowerCase().trim();
                    const disLow  = diseaseSymptom.toLowerCase().trim();

                    // 1. Tam eşleşme (en güvenilir)
                    if (selLow === disLow) return true;

                    // 2. Parantezi yok say tam eşleşme: "Ödem (bilateral)" = "Ödem"
                    const selBase = selLow.split('(')[0].trim();
                    const disBase = disLow.split('(')[0].trim();
                    if (selBase === disBase) return true;

                    // 3. Her iki tarafın kök kelimelerini çıkar
                    const selWords = extractKeywords(selLow);
                    const disWords = extractKeywords(disLow);

                    if (selWords.length === 0 || disWords.length === 0) return false;

                    // 4. Her iki tarafın birinci (kök) kelimesi kesinlikle örtüşmeli
                    //    "yaygın ödem" ↔ "yaygın eritem" → "ödem" ≠ "eritem" → eşleşme YOK
                    //    "yaygın ödem" ↔ "yaygın ödem (alt ext)" → "ödem" = "ödem" → eşleşme VAR
                    const selCore = selBase.split(/\s+/)[0]; // "yaygın ödem" → "yaygın", "ödem" 2. kelime
                    const disCore = disBase.split(/\s+/)[0];

                    // 4a. Her iki taraftan anlamlı kelimelerin ortak kesişim oranı
                    const overlap = selWords.filter(sw =>
                        disWords.some(dw =>
                            dw === sw ||
                            (sw.length >= 5 && (dw.startsWith(sw) || sw.startsWith(dw)))
                        )
                    );

                    // En az 2 anlamlı kelime örtüşmeli VEYA
                    // tek anlamlı kelime varsa o kesinlikle örtüşmeli
                    const minWords = Math.min(selWords.length, disWords.length);
                    if (minWords <= 1) {
                        // Tek kelimeli semptomlar: tam örtüşme zorunlu
                        return overlap.length >= 1 && selWords[0] === disWords[0];
                    }
                    if (minWords === 2) {
                        // 2 kelimeli: en az 2 ortak kelime
                        return overlap.length >= 2;
                    }
                    // 3+ kelimeli: en az 2 ortak veya %60 örtüşme
                    return overlap.length >= 2 || (overlap.length / minWords) >= 0.6;
                }

                matchedSymptoms = diseaseSymptoms.filter(s =>
                    selectedSymptoms.some(sel => symptomMatch(sel, s))
                );
                unmatchedSymptoms = diseaseSymptoms.filter(s => !matchedSymptoms.includes(s));
                symptomScore = (matchedSymptoms.length / diseaseSymptoms.length) * 100;
            } else {
                // Hastalığın semptomu yoksa: semptom skoru nötr (0 değil, 50)
                // Çünkü semptom verisi olmayan hastalık ne olursa olsun eşleşiyor sayılmaz
                symptomScore = 0;
            }

            // ── Semptom seçildi mi kontrolü ──────────────────────
            // Hiç semptom girilmemişse bu hastalığı tamamen atla (anlamlı skor üretemez)
            if (selectedSymptoms.length === 0 && diseaseSymptoms.length > 0) {
                symptomScore = 0;
            }

            // ── D. LAB / SEROLOJİ SKORU (%20) ────────────────────────────────
            const anyLabEntered = Object.values(labs).some(v => v !== null && v !== undefined)
                || (labResults || '').trim().length > 2;

            // Hiç lab girilmemişse: nötr (50) — skoru ne yükseltir ne düşürür
            // Lab girilmişse: 0'dan başla, eşleşenler artırır
            let labScore = anyLabEntered ? 0 : 50;
            let matchedLabs = [];
            let totalLabWeight = 0;
            let matchedLabWeight = 0;

            // D1. Sayısal lab değerleriyle eşleştirme (eski disease.labs formatı)
            if (disease.labs && Object.keys(disease.labs).length > 0) {
                Object.keys(disease.labs).forEach(labKey => {
                    const labValue = labs[labKey];
                    const condition = disease.labs[labKey];
                    if (labValue !== null && labValue !== undefined) {
                        totalLabWeight += (condition.weight || 10);
                        let isMatch = false;
                        if (condition.type === 'range') {
                            if (labValue >= condition.min && labValue <= condition.max) isMatch = true;
                        } else if (condition.type === 'high') {
                            const ref = getLabReference('lab' + labKey.charAt(0).toUpperCase() + labKey.slice(1));
                            if (labValue > ref.max) isMatch = true;
                        } else if (condition.type === 'low') {
                            const ref = getLabReference('lab' + labKey.charAt(0).toUpperCase() + labKey.slice(1));
                            if (labValue < ref.min) isMatch = true;
                        } else if (condition.type === 'positive') {
                            if (labValue === 'pozitif' || labValue === 'positive' || labValue === true) isMatch = true;
                        } else if (condition.type === 'exact') {
                            if (labValue == condition.value) isMatch = true;
                        }
                        if (isMatch) {
                            matchedLabWeight += (condition.weight || 10);
                            matchedLabs.push(`${condition.name || labKey}: ${labValue}`);
                        }
                    }
                });
                if (totalLabWeight > 0) {
                    labScore = (matchedLabWeight / totalLabWeight) * 100;
                }
            }

            // D2. Metin tabanlı lab/seroloji eşleştirme (yeni labFindings[] dizisi)
            // Kullanıcının girdiği lab sonuçları ile hastalığın beklenen bulgularını eşleştir
            const userLabText = (labResults || '').toLowerCase().trim();
            if (userLabText.length > 3 && disease.labFindings && disease.labFindings.length > 0) {
                // Kullanıcı lab metinini kelimelere böl
                const userLabWords = userLabText
                    .replace(/[()[\]/\-,.;:]/g, ' ')
                    .split(/\s+/)
                    .filter(w => w.length >= 4);

                let labMatches = 0;
                const labMatchDetails = [];

                disease.labFindings.forEach(finding => {
                    if (!finding || finding.length < 4) return;
                    const fLow = finding.toLowerCase().replace(/[()[\]/\-,.;:]/g, ' ');
                    const fWords = fLow.split(/\s+/).filter(w => w.length >= 4);

                    // Bulgunun anlamlı kelimeleri kullanıcı metninde var mı?
                    const matchCount = fWords.filter(fw =>
                        userLabWords.some(uw => uw === fw || (fw.length >= 5 && (uw.startsWith(fw) || fw.startsWith(uw))))
                    ).length;

                    if (matchCount >= Math.min(2, Math.ceil(fWords.length * 0.5))) {
                        labMatches++;
                        labMatchDetails.push(finding.substring(0, 60));
                    }
                });

                if (labMatches > 0) {
                    // Lab eşleşme oranını hesapla
                    const labMatchRate = (labMatches / disease.labFindings.length) * 100;
                    // Mevcut labScore ile ağırlıklı birleştir
                    if (totalLabWeight === 0) {
                        // Sadece metin tabanlı skor var
                        labScore = Math.min(100, labMatchRate * 1.5);
                    } else {
                        labScore = Math.min(100, (labScore * 0.5) + (labMatchRate * 0.5));
                    }
                    matchedLabs.push(...labMatchDetails);
                }
            }

            // ── E. PREVALANS SKORU (%30) ──────────────────────────
            let prevalenceScore = cfg.prevalenceScores[disease.prevalence] || 50;
            let prevalenceLabel = disease.prevalence || 'medium';

            // Yaş/Kategori bazlı prevalans bonusu
            if (cfg.prevalenceBonus) {
                Object.values(cfg.prevalenceBonus).forEach(bonus => {
                    if (age >= (bonus.minAge || 0) && disease.category && disease.category.includes(bonus.category)) {
                        prevalenceScore = Math.min(100, prevalenceScore + (bonus.bonus || 0));
                    }
                });
            }

            // Radyoloji / Patoloji bonus skoru
            let imagingBonus = 0;
            const radText = (imagingResults || '').toLowerCase().trim();

            // Yeni format: disease.radiology[] dizisi
            if (radText.length > 3) {
                const radFindings = disease.radiology && disease.radiology.length > 0
                    ? disease.radiology
                    : (disease.radiologyNotes ? [disease.radiologyNotes] : []);

                if (radFindings.length > 0) {
                    const userRadWords = radText.replace(/[()[\]/\-,.;:]/g, ' ')
                        .split(/\s+/).filter(w => w.length > 3);
                    let radMatches = 0;

                    radFindings.forEach(finding => {
                        const fWords = finding.toLowerCase()
                            .replace(/[()[\]/\-,.;:]/g, ' ')
                            .split(/\s+/).filter(w => w.length > 3);
                        const overlap = fWords.filter(fw =>
                            userRadWords.some(uw => uw === fw || (fw.length >= 5 && (uw.startsWith(fw) || fw.startsWith(uw))))
                        );
                        if (overlap.length >= Math.min(2, Math.ceil(fWords.length * 0.4))) {
                            radMatches++;
                        }
                    });
                    imagingBonus = Math.min(20, radMatches * 5);
                }
            }

            let pathologyBonus = 0;
            const pathText = (pathologyResults || '').toLowerCase().trim();
            if (pathText.length > 3) {
                const pathFindings = disease.pathology && disease.pathology.length > 0
                    ? disease.pathology
                    : (disease.pathologyNotes ? [disease.pathologyNotes] : []);

                if (pathFindings.length > 0) {
                    const userPathWords = pathText.replace(/[()[\]/\-,.;:]/g, ' ')
                        .split(/\s+/).filter(w => w.length > 4);
                    let pathMatches = 0;

                    pathFindings.forEach(finding => {
                        const fWords = finding.toLowerCase()
                            .replace(/[()[\]/\-,.;:]/g, ' ')
                            .split(/\s+/).filter(w => w.length > 4);
                        const overlap = fWords.filter(fw =>
                            userPathWords.some(uw => uw === fw || (fw.length >= 5 && (uw.startsWith(fw) || fw.startsWith(uw))))
                        );
                        if (overlap.length >= 1) pathMatches++;
                    });
                    pathologyBonus = Math.min(20, pathMatches * 5);
                }
            }

            // ── F. TOPLAM SKOR (Ağırlıklı ortalama) ──────────────
            const w = cfg.weights;

            // Lab skoru hesabında: lab girilmediyse weight'i prevalansa yap
            const effectiveLabWeight = anyLabEntered ? w.lab : 0;
            const effectiveSymptomWeight = w.symptom + (anyLabEntered ? 0 : w.lab * 0.3);
            const effectivePrevalenceWeight = w.prevalence + (anyLabEntered ? 0 : w.lab * 0.7);

            const baseScore = (symptomScore * effectiveSymptomWeight)
                + (prevalenceScore * effectivePrevalenceWeight)
                + (labScore * effectiveLabWeight);
            const totalScore = Math.min(100, baseScore + imagingBonus + pathologyBonus);

            // ── Minimum eşik kontrolü ─────────────────────────────
            const minScore = cfg.thresholds.minScore;

            // ── KESİN KURAL: Semptom seçilmemişse sonuç üretme ───
            // Sadece lab/seroloji girilse de semptom olmadan güvenilir tanı olmaz
            if (selectedSymptoms.length === 0) return;

            // Semptom girildi ama bu hastalıkla hiç eşleşmiyorsa: listeye alma
            if (matchedSymptoms.length === 0) return;

            // Normal eşik kontrolü
            if (totalScore <= minScore) return;

            results.push({
                disease, totalScore, symptomScore, prevalenceScore, labScore,
                matchedSymptoms, unmatchedSymptoms, matchedLabs, prevalenceLabel,
                imagingBonus, pathologyBonus
            });
        });

        results.sort((a, b) => {
            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
            return b.prevalenceScore - a.prevalenceScore;
        });

        displayResults(results.slice(0, algorithmConfig.thresholds.maxResults));
        document.getElementById('loadingSection').classList.remove('active');
        document.getElementById('resultsSection').classList.add('active');
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 800);
}

// ==========================================
// SONUÇLARI GÖSTER
// ==========================================

function displayResults(results) {
    const container = document.getElementById('diseaseList');
    container.innerHTML = '';
    if (results.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                <div style="font-weight: 700; color: var(--text); margin-bottom: 0.5rem;">Sonuç Bulunamadı</div>
                <div>Seçili semptomlar ve demografik verilerle eşleşen hastalık bulunamadı. Lütfen semptomları genişletin veya filtreleri kontrol edin.</div>
            </div>`;
        return;
    }
    results.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'disease-item';
        if (result.totalScore >= 70) item.classList.add('high-probability');
        else if (result.totalScore >= 40) item.classList.add('medium-probability');
        else if (result.prevalenceLabel === 'rare') item.classList.add('rare');
        else item.classList.add('low-probability');

        const prevBadgeClass = { high: 'prev-high', medium: 'prev-medium', low: 'prev-low', rare: 'prev-rare' }[result.prevalenceLabel] || 'prev-medium';
        const prevText = { high: 'Yaygın', medium: 'Orta', low: 'Nadir', rare: 'Çok Nadir' }[result.prevalenceLabel] || 'Orta';

        const bonusInfo = (result.imagingBonus > 0 || result.pathologyBonus > 0)
            ? `<span title="Görüntüleme/Patoloji Bonus">📷 +${result.imagingBonus + result.pathologyBonus}%</span>` : '';

        item.innerHTML = `
            <div class="disease-header">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <span class="disease-name">${result.disease.name}</span>
                    <span class="disease-code">${result.disease.code || 'Kod Yok'}</span>
                    <span class="prevalence-badge ${prevBadgeClass}">${prevText}</span>
                    ${result.disease.category ? `<span class="badge" style="background: #e0e7ff; color: #3730a3;">${result.disease.category}</span>` : ''}
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">${result.totalScore.toFixed(1)}%</div>
                    <div style="font-size: 0.75rem; color: var(--secondary);">Eşleşme</div>
                </div>
            </div>
            <div class="match-score">
                <div class="score-bar">
                    <div class="score-fill" style="width: ${Math.min(100, result.totalScore)}%"></div>
                </div>
            </div>
            <div class="score-breakdown">
                <span title="Semptom Uyumu">🩺 ${result.symptomScore.toFixed(0)}%</span>
                <span title="Prevalans Ağırlığı">📊 ${result.prevalenceScore.toFixed(0)}%</span>
                <span title="Lab Uyumu">🧪 ${result.labScore.toFixed(0)}%</span>
                ${bonusInfo}
                <span style="margin-left: auto; color: ${result.matchedSymptoms.length > 0 ? 'var(--success)' : 'var(--secondary)'};">
                    ✓ ${result.matchedSymptoms.length}/${result.matchedSymptoms.length + result.unmatchedSymptoms.length} semptom
                </span>
            </div>
            <div class="disease-details" id="details-${index}">
                <div class="detail-section">
                    <div class="detail-label">🩺 Eşleşen Semptomlar (${result.matchedSymptoms.length}):</div>
                    <div>
                        ${result.matchedSymptoms.length > 0
                            ? result.matchedSymptoms.map(s => `<span class="badge matched">${s}</span>`).join('')
                            : '<span style="color: var(--secondary); font-style: italic;">Eşleşen semptom bulunamadı</span>'
                        }
                    </div>
                </div>
                ${result.unmatchedSymptoms.length > 0 ? `
                <div class="detail-section">
                    <div class="detail-label">⏳ Beklenen Ancak Seçilmeyen Semptomlar:</div>
                    <div>
                        ${result.unmatchedSymptoms.slice(0, 5).map(s => `<span class="badge">${s}</span>`).join('')}
                        ${result.unmatchedSymptoms.length > 5 ? `<span class="badge">+${result.unmatchedSymptoms.length - 5} daha...</span>` : ''}
                    </div>
                </div>` : ''}
                ${result.matchedLabs.length > 0 ? `
                <div class="detail-section">
                    <div class="detail-label">🧪 Eşleşen Seroloji / Lab Bulguları:</div>
                    <div>${result.matchedLabs.map(l => `<span class="badge matched-lab">${l}</span>`).join('')}</div>
                </div>` : ''}
                ${(result.disease.labFindings && result.disease.labFindings.length > 0) ? `
                <div class="detail-section">
                    <div class="detail-label">📋 Beklenen Seroloji / Lab Bulguları:</div>
                    <div>${result.disease.labFindings.slice(0, 6).map(l => `<span class="badge" style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;">${l}</span>`).join('')}${result.disease.labFindings.length > 6 ? `<span class="badge">+${result.disease.labFindings.length-6} daha</span>` : ''}</div>
                </div>` : ''}
                ${(result.disease.radiology && result.disease.radiology.length > 0) ? `
                <div class="detail-section">
                    <div class="detail-label">📷 Beklenen Radyoloji Bulguları${result.imagingBonus > 0 ? ` <span style="color:var(--success);font-size:0.78rem;">+${result.imagingBonus} bonus</span>` : ''}:</div>
                    <div>${result.disease.radiology.slice(0, 4).map(r => `<span class="badge" style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;">${r}</span>`).join('')}${result.disease.radiology.length > 4 ? `<span class="badge">+${result.disease.radiology.length-4} daha</span>` : ''}</div>
                </div>` : (result.disease.radiologyNotes ? `
                <div class="detail-section">
                    <div class="detail-label">📷 Radyoloji Notları:</div>
                    <div style="color: var(--secondary); font-size: 0.85rem;">${result.disease.radiologyNotes}</div>
                </div>` : '')}
                ${(result.disease.pathology && result.disease.pathology.length > 0) ? `
                <div class="detail-section">
                    <div class="detail-label">🔬 Patoloji Bulguları${result.pathologyBonus > 0 ? ` <span style="color:var(--success);font-size:0.78rem;">+${result.pathologyBonus} bonus</span>` : ''}:</div>
                    <div style="color: var(--secondary); font-size: 0.85rem;">${result.disease.pathology.slice(0,3).join(' • ')}</div>
                </div>` : (result.disease.pathologyNotes ? `
                <div class="detail-section">
                    <div class="detail-label">🔬 Patoloji Notları:</div>
                    <div style="color: var(--secondary); font-size: 0.85rem;">${result.disease.pathologyNotes}</div>
                </div>` : '')}
                ${result.disease.ageRange ? `
                <div class="detail-section">
                    <div class="detail-label">👤 Yaş Aralığı:</div>
                    <div style="color: var(--secondary);">${result.disease.ageRange.min}-${result.disease.ageRange.max} yaş
                        ${result.disease.gender && result.disease.gender !== 'both' ? `• ${result.disease.gender === 'erkek' ? 'Erkek' : 'Kadın'}` : '• Her iki cinsiyet'}
                    </div>
                </div>` : ''}
            </div>
            <div style="text-align: center; margin-top: 0.5rem; color: var(--primary); font-size: 0.875rem; font-weight: 600; cursor: pointer;" onclick="toggleDetails(${index})">
                Detayları Göster/Gizle ↕
            </div>`;
        container.appendChild(item);
    });
}

function toggleDetails(index) {
    const details = document.getElementById(`details-${index}`);
    if (details) details.classList.toggle('show');
}

// ==========================================
// BAŞLAT
// ==========================================
window.onload = initApp;
