/**
 * algoritma.js
 * Semptomdan Tanıya - Klinik Karar Destek Sistemi
 * Dr. Feridun Karadağ - v3.0
 * Algoritma Motoru: Semptom + Lab + Prevalans Ağırlıklı Skorlama
 */

// ==========================================
// ALGORİTMA KONFİGÜRASYONU (Admin panelden değiştirilebilir)
// ==========================================

const DEFAULT_ALGORITHM_CONFIG = {
    // Skor ağırlıkları (toplamı 100 olmalı)
    symptomWeight:    0.50,   // Semptom ağırlığı %50
    labWeight:        0.20,   // Laboratuvar ağırlığı %20
    prevalenceWeight: 0.30,   // Prevalans ağırlığı %30

    // Prevalans skorları
    prevalenceScores: {
        high:   100,
        medium:  60,
        low:     30,
        rare:    10
    },

    // Minimum toplam skor eşiği (bu altı gösterilmez)
    minTotalScore: 15,

    // Maksimum gösterilecek sonuç sayısı
    maxResults: 20,

    // Cinsiyet filtreleri
    genderFilters: {
        enabled: true,
        // Erkekte çıkmayacak kategoriler
        maleExcludeCategories: ['Jinekoloji'],
        // Kadında çıkmayacak kategoriler (prostat vb.)
        femaleExcludeCategories: [],
        // Erkekte çıkmayacak anahtar kelimeler (hastalık adında geçenler)
        maleExcludeKeywords: ['Uterus', 'Ovar', 'Vajin', 'Rahim', 'Serviks', 'Vulva', 'Endometri', 'Plasenta', 'Gebelik', 'Eklamsi', 'Menstrü'],
        // Kadında çıkmayacak anahtar kelimeler
        femaleExcludeKeywords: ['Prostat', 'Testis', 'Penis', 'Epididim']
    },

    // Yaş grubu filtreleri
    ageGroupFilters: {
        enabled: true,
        // Yenidoğan (0-1 ay)
        newbornMaxAge: 0.08,   // ~1 ay
        // Pediatrik (0-17)
        pediatricMaxAge: 17,
        // Geriatrik başlangıcı
        geriatricMinAge: 65,

        // Bu kategoriler sadece pediatride görülür → erişkinde çıkmaz
        pediatricOnlyCategories: ['Pediatri'],
        pediatricOnlyKeywords: ['Yenidoğan', 'Pediatrik', 'Çocukluk çağı', 'Konjenital'],

        // Bu kategoriler sadece erişkinde görülür → pediatride çıkmaz
        adultOnlyMinAge: 18,
        adultOnlyCategories: [],
        adultOnlyKeywords: ['Menopoz', 'Prostat', 'Koroner', 'Ateroskleroz']
    },

    // Ek prevalans düzeltmeleri
    prevalenceAdjustments: {
        // Kardiyovasküler hastalıklar → 60 yaş üstünde prevalansı artır
        kardiyovaskulerAgeBonus: { category: 'Kardiyovasküler Hastalıklar', minAge: 60, bonus: 15 },
        // Pediatrik hastalıklar → erişkinde prevalansı sıfırla
        pediatriAdultPenalty: { category: 'Pediatri', minAge: 18, score: 0 }
    }
};

// localStorage'dan config'i yükle (admin değişiklikleri)
function loadAlgorithmConfig() {
    try {
        const saved = localStorage.getItem('adminAlgorithmConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Deep merge
            return deepMerge(DEFAULT_ALGORITHM_CONFIG, parsed);
        }
    } catch(e) {
        console.warn('Algorithm config yüklenemedi, varsayılan kullanılıyor:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_ALGORITHM_CONFIG));
}

function deepMerge(target, source) {
    const result = Object.assign({}, target);
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

let algorithmConfig = loadAlgorithmConfig();

// ==========================================
// SEMPTOM VERİTABANI (400+ Semptom - 12 Sistem)
// ==========================================

const symptomDatabase = {
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
        "Hemiparezi (tek taraf güçsüzlük)", "Paraparezi (bacak güçsüzlüğü)",
        "Tetraparezi (4 ekstremite güçsüzlüğü)", "Monoparezi (tek ekstremite)", "Plejia (felç)",
        "Hemiplejia (tek taraf felç)", "Fasial paralizi (yüz felci)", "Bell paralizisi (periferik yüz felci)",
        "Diplopi (çift görme)", "Görme bulanıklığı", "Skuotoma (görme alanı kaybı)", "Hemianopsi (yarım görme)",
        "Nistagmus (göz titremesi)", "Afazi (konuşma bozukluğu)", "Broca afazisi (anlayan ama konuşamayan)",
        "Wernicke afazisi (konuşan ama anlamayan)", "Dizartri (söyleniş bozukluğu)",
        "Disfaji (yutma güçlüğü)", "Romberg pozitifliği (göz kapalı dengesizlik)", "Babinski pozitifliği",
        "Menenjeal irritasyon (ense sertliği)", "Kernig işareti", "Brudzinski işareti",
        "Fotofobi (ışık korkusu)", "Fonofobi (ses korkusu)", "Rigidity (kas sertliği)",
        "Beyin ödemi bulguları (papil ödem, Cushing triadı)"
    ],
    'Endokrin': [
        "Poliüri (çok idrar)", "Polidipsi (çok su içme)", "Polifaji (çok yeme)",
        "Kilo kaybı (aşırı iştahla birlikte)", "Soğuğa tahammülsüzlük", "Sıcağa tahammülsüzlük",
        "Terleme (Hiperhidroz)", "Aşırı terleme", "Hipertiroidi bulguları (gözlerde büyüme, el titremesi)",
        "Hipotiroidi bulguları (şişlik, yorgunluk)", "Guatr (boyun şişliği - tiroid)", "Tremor (el titremesi - ince)",
        "Kaba tremor (hipoglisemi tremoru)", "Taşikardi (tiroid kaynaklı)", "Bradikardi (hipotiroidi)",
        "Osteoporoz ağrısı (kemik ağrısı)", "Patolojik kırık (düşük enerjili kırık)",
        "Tiroid kaynaklı saç dökülmesi", "Menstrüel düzensizlik (Oligomenore)", "Amenore (adet görmeme)",
        "Menoraji (ağır adet kanaması)", "Galaktore (süt gelmesi - hamile değilken)",
        "Cinsel fonksiyon bozukluğu (ereksiyon bozukluğu)", "İktidarsızlık", "Libido değişikliği",
        "Gynecomastia (erkekte meme büyümesi)", "Hirsutism (kadında erkeksi kıllanma)",
        "Acanthosis nigricans (boyunda koyulaşma)", "Stria (karında çatlaklar)", "Obezite (metabolik)",
        "Metabolik sendrom bulguları", "Hipoglisemi belirtileri (terleme, çarpıntı, açlık hissi)"
    ],
    'Romatoloji': [
        "Eklem ağrısı (Artaralji)", "Eklem şişliği (Artrit)", "Morning stiffness (sabah tutukluğu)",
        "Hareket kısıtlılığı (ROM kısıtlılığı)", "Kontraktür (sözleşme)", "Deformite (şekil bozukluğu)",
        "Krepitasyon (eklemden ses)", "Kas ağrısı (Miyalji)", "Kas güçsüzlüğü (Miyopati)",
        "Yaygın vücut ağrısı", "Fibromiyalji (yaygın ağrı + yorgunluk)", "Tetik noktalar (Fibromiyalji noktaları)",
        "Sırt ağrısı (Lomber)", "Bel ağrısı (Lumbago)", "Boyun ağrısı (Servikalji)",
        "Radiküler ağrı (sinir kökü ağrısı - kol/bacağa vuran)", "Nöropatik ağrı (yanıcı-batıcı)",
        "Enflamatuvar belirtiler (kızarıklık-sıcaklık)", "Eklem üzeri cilt kızarıklığı",
        "Eklem sıcaklığı artışı", "Romatoid nodül (dirsekte sert kitle)", "Heberden nodülü (el parmakları)",
        "Bouchard nodülü (el orta parmak eklemi)", "Sakroileit (bel omurgası ağrısı)",
        "Omurga tutulumu (sabitlik)", "Spondiloz (dejenerasyon)", "Spondilolistezis (omurga kayması)",
        "Skolyoz (yan eğrilik)", "Kifoz (kamburluk)", "Lordoz (belde aşırı içbükeylik)"
    ],
    'Dermatoloji': [
        "Pruritus (Kaşıntı)", "Eritema (Kızarıklık)", "Makül (düz leke)", "Papül (kabarık leke)",
        "Vezikül (su kabarcığı)", "Büll (büyük su kabarcığı)", "Püstül (irinli kabarcık)",
        "Kabuk (Eroziyon üzeri)", "Erozyon (yüzeysel yara)", "Ülser (derin yara)",
        "Nekroz (doku ölümü-siyah)", "Skar (yara izi)", "Atrofi (incelme)", "Likenifikasyon (kalınlaşma)",
        "Maküler döküntü (düz kızarıklık)", "Papüler döküntü (kabarcıklı)", "Makulopapüler döküntü (karışık)",
        "Ürtiker (kurdeşen-beyaz kabarıklık)", "Anjiyödem (derin ödem-dudak/şişlik)", "Purpura (kanama)",
        "Petechia (nokta kanama)", "Eşimoz (morluk)", "Hematoma (kaba kanama)", "Sarılık (cilt sararması)",
        "Hipopigmentasyon (beyazlaşma-Vitiligo)", "Hiperpigmentasyon (kararma-Melazma)",
        "Alopesia (saç dökülmesi)", "Onikoliz (tırnak ayrılması)", "Onikomikoz (tırnak mantarı)",
        "Paroniji (tırnak eti iltihabı)", "Psoriazis (sedef-kırmızı gümüş)", "Liken planus (düz liken-mor papül)",
        "Akne (sivilce)", "Rosacea (gül hastalığı)", "Furunkül (çıban)", "Karbunkül (birleşik çıban)",
        "Selülit (cilt altı iltihabı)", "Abse (apse)", "Hidradenitis suppurativa (koltuk altı apseleşmesi)"
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
        "Kronik retansiyon (tam boşaltamama)", "Prostat ağrısı (perende arası)",
        "Erektil disfonksiyon (sertleşme bozukluğu)", "Priapizm (ağrılı sürekli sertleşme)",
        "Hematospermia (menide kan)", "Epididim ağrısı (testis üstü)", "Orşit (testis iltihabı)",
        "Orkialji (testis ağrısı)", "Skrotal şişlik (torbada şişlik)",
        "Hidrosel (torbada su toplanması)", "Varikosel (damar genişlemesi-testis üstü)"
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
        "Vazomotor semptomlar (sıcak basması-terleme)", "Libido değişikliği",
        "İnfertilite (kısırlık)", "Düşük tehdidi (vajinal kanama-karın ağrısı-gebelikte)",
        "Gebelik bulantısı (Hyperemesis gravidarum-şiddetli)", "Gebelik hipertansiyonu (preeklampsi)",
        "Eklampsi (nöbet geçirme-gebelikte)", "HELLP sendromu", "Gestasyonel diyabet (gebelik şekeri)"
    ],
    'Psikiyatri': [
        "Anksiyete (kaygı)", "Endişe", "Panik atak (ani korku-palpitesyon)", "Panik bozukluk",
        "Fobi (korku)", "Sosyal fobi (toplum içi korku)", "Agorafobi (dışarı çıkma korkusu)",
        "Obsesyon (takıntı düşünce)", "Kompulsiyon (takıntı davranış-tekrarlama)", "OCD (obsesif-kompulsif)",
        "Tik (motor-ses)", "Depresyon (Major depresif epizod)", "Mutsuzluk (Persistent)", "Anhedonia (zevk alamama)",
        "Umutsuzluk", "Değersizlik hissi", "Suçluluk hissi (aşırı)", "Psikomotor retardasyon (yavaşlama)",
        "Psikomotor ajitasyon (hareketlilik)", "İnsomnia (uyuyamama)", "Uyku bozukluğu",
        "Erken uyanma (depresif)", "Hipersonnia (aşırı uyuma)", "Kabus (Rüya)", "Gece terörü (Night terror)",
        "Somnambulizm (uyurgezerlik)", "Manik bulgular", "Efori (aşırı keyif)",
        "Halüsinasyon (sanrı duyu)", "İşitsel halüsinasyon (ses duyma)", "Görsel halüsinasyon (görme)",
        "Sanrı (Delusion)", "Perseküsyon sanrısı (zarar verme sanrısı)",
        "Demans bulguları (bellek kaybı-kişilik değişimi)", "Anterograde amnezi (yeni öğrenememe)",
        "Retrograde amnezi (geçmişi hatırlayamama)", "Anoreksia nervosa (aşırı zayıflama-korku)",
        "Bulimia nervosa (tıkınıp çıkarma)", "Binge eating (tıkınırcasına yeme)",
        "Madde kullanımı bağımlılığı", "Yoksunluk bulguları (withdrawal)", "İntihar düşüncesi",
        "Agresiflik (saldırganlık)", "Impulsivite (dürtüsellik)",
        "Dikkat dağınıklığı (Attention deficit)", "Hiperaktivite (Hyperactivity)"
    ],
    'Hematoloji': [
        "Pallor (cilt solukluğu)", "Yorgunluk (Kronik anemi)", "Halsizlik (ağır anemi)",
        "Baş dönmesi (pozisyonel-anemi)", "Senkop (anemik)", "Dispne (nefes darlığı-anemi)",
        "Angina (göğüs ağrısı-anemik)", "Takikardi (kalp çarpıntısı-dengeleme)", "Peteşia (ciltte nokta kanama)",
        "Purpura (deri altı kanamalar)", "Eşimoz (morluklar)", "Epistaksis (burun kanaması-tekrarlayan)",
        "Gingival kanama (diş eti kanaması)", "Hemoptizi (kanlı balgam-koagülopati)", "Melena (siyah dışkı)",
        "Hematokezya (dışkıda kan)", "Hematuri (idrar kanı)", "Menoraji (aşırı adet kanaması)",
        "Metroraji (düzensiz ağır kanama)", "Hemartroz (eklem içi kanama)", "Spontan hematom (nedensiz morluk)",
        "Enjeksiyon yerinde aşırı kanama", "Gece terlemesi (hematolojik-lenfoma)", "Kilo kaybı (hematolojik)",
        "Lenfadenopati (genelleşmiş-büyümüş lenf nodları)", "Hepatosplenomegali (karaciğer-dalak büyümesi)",
        "Kemik ağrısı (sternum-tibia)", "Sternal hassasiyet (kemik iliği basıncı)",
        "Pika (anormal yeme-toprak-kil)", "Pagofaji (buz yeme-demir eksikliği)"
    ]
};

// Semptom eş anlamlıları (anamnez analizi için)
const SYMPTOM_SYNONYMS = {
    'baş ağrısı': ['başım ağrıyor', 'baş ağrısı', 'migren', 'şiddetli baş ağrısı', 'başın ağrıması'],
    'göğüs ağrısı': ['göğsümde ağrı', 'göğüs ağrısı', 'kalbimde ağrı', 'sternum ağrı', 'göğsümde baskı'],
    'nefes darlığı': ['nefes darlığı', 'soluk soluğa kalma', 'nefesim yetmiyor', 'dispne', 'nefes almakta zorlanıyorum'],
    'karın ağrısı': ['karın ağrısı', 'karnımda ağrı', 'göbek ağrısı', 'batında ağrı'],
    'bulantı': ['bulantı', 'midem bulanıyor', 'kusma hissi', 'mide bulantısı'],
    'ateş': ['ateş', 'ateşim var', 'ısındım', 'titreme', 'harpasız ateş'],
    'öksürük': ['öksürük', 'öksürüyorum', 'balgam', 'kuru öksürük'],
    'şişlik': ['şişlik', 'ödem', 'şişme', 'topak'],
    'kanama': ['kanama', 'kanıyor', 'kanlı', 'kan geliyor'],
    'yorgunluk': ['yorgunluk', 'bitkinlik', 'halsizlik', 'takatsizlik'],
    'baş dönmesi': ['baş dönmesi', 'sersemlik', 'denge kaybı'],
    'ağrı': ['ağrı', 'ağrıyor', 'sancı', 'rahatsızlık']
};

// ==========================================
// LABORATUVAR REFERANS DEĞERLERİ
// ==========================================

const LAB_REFERENCES = {
    'wbc':        { min: 4,    max: 10,    name: 'WBC (10³/μL)' },
    'hgb':        { min: 12,   max: 16,    name: 'Hemoglobin (g/dL)' },
    'plt':        { min: 150,  max: 400,   name: 'Platelet (10³/μL)' },
    'mcv':        { min: 80,   max: 100,   name: 'MCV (fL)' },
    'crp':        { min: 0,    max: 5,     name: 'CRP (mg/L)' },
    'esr':        { min: 0,    max: 20,    name: 'ESR (mm/h)' },
    'glucose':    { min: 70,   max: 100,   name: 'Glukoz (mg/dL)' },
    'urea':       { min: 10,   max: 50,    name: 'Üre (mg/dL)' },
    'creatinine': { min: 0.6,  max: 1.2,   name: 'Kreatinin (mg/dL)' },
    'ast':        { min: 0,    max: 40,    name: 'AST (U/L)' },
    'alt':        { min: 0,    max: 40,    name: 'ALT (U/L)' },
    'alp':        { min: 40,   max: 130,   name: 'ALP (U/L)' },
    'bilirubin':  { min: 0.3,  max: 1.2,   name: 'Total Bilirubin (mg/dL)' },
    'albumin':    { min: 3.5,  max: 5.0,   name: 'Albumin (g/dL)' },
    'sodium':     { min: 135,  max: 145,   name: 'Sodyum (mEq/L)' },
    'potassium':  { min: 3.5,  max: 5.0,   name: 'Potasyum (mEq/L)' },
    'calcium':    { min: 8.5,  max: 10.5,  name: 'Kalsiyum (mg/dL)' },
    'troponin':   { min: 0,    max: 0.014, name: 'Troponin (ng/L)' },
    'bnp':        { min: 0,    max: 100,   name: 'BNP (pg/mL)' },
    'tsh':        { min: 0.4,  max: 4.0,   name: 'TSH (mIU/L)' },
    't4':         { min: 0.8,  max: 1.8,   name: 'Serbest T4 (ng/dL)' },
    'tg':         { min: 0,    max: 150,   name: 'Trigliserid (mg/dL)' },
    'ckmb':       { min: 0,    max: 25,    name: 'CK-MB (U/L)' },
    'ddimer':     { min: 0,    max: 500,   name: 'D-Dimer (μg/mL)' },
    'lactate':    { min: 0.5,  max: 2.2,   name: 'Laktat (mmol/L)' },
    'cortisol':   { min: 6,    max: 23,    name: 'Kortizol (μg/dL)' },
    'abgph':      { min: 7.35, max: 7.45,  name: 'Kan Gazı pH' },
    'abgpo2':     { min: 80,   max: 100,   name: 'pO2 (mmHg)' },
    'abgpco2':    { min: 35,   max: 45,    name: 'pCO2 (mmHg)' },
    'abghco3':    { min: 22,   max: 26,    name: 'HCO3 (mEq/L)' }
};

// ==========================================
// LAB DEĞERİ OKUMA FONKSİYONLARI
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

function getLabReference(labKey) {
    return LAB_REFERENCES[labKey] || { min: 0, max: 999, name: labKey };
}

// Tüm lab değerlerini topla
function collectLabValues() {
    return {
        wbc:          getLabValue('labWBC'),
        hgb:          getLabValue('labHgb'),
        plt:          getLabValue('labPlt'),
        mcv:          getLabValue('labMCV'),
        crp:          getLabValue('labCRP'),
        esr:          getLabValue('labESR'),
        glucose:      getLabValue('labGlu'),
        urea:         getLabValue('labUrea'),
        creatinine:   getLabValue('labCre'),
        ast:          getLabValue('labAST'),
        alt:          getLabValue('labALT'),
        alp:          getLabValue('labALP'),
        bilirubin:    getLabValue('labBil'),
        albumin:      getLabValue('labAlb'),
        sodium:       getLabValue('labNa'),
        potassium:    getLabValue('labK'),
        calcium:      getLabValue('labCa'),
        troponin:     getLabValue('labTrop'),
        bnp:          getLabValue('labBNP'),
        ckmb:         getLabValue('labCKMB'),
        ddimer:       getLabValue('labDimer'),
        tsh:          getLabValue('labTSH'),
        t4:           getLabValue('labT4'),
        cortisol:     getLabValue('labCortisol'),
        tg:           getLabValue('labTG'),
        lactate:      getLabValue('labLactate'),
        abgph:        getLabValue('labABGpH'),
        abgpo2:       getLabValue('labABGpO2'),
        abgpco2:      getLabValue('labABGpCO2'),
        abghco3:      getLabValue('labABGHCO3'),
        urineProtein: getLabValue('labProtein'),
        urineLeuko:   getLabValue('labLeuko'),
        urineNitrit:  getLabValue('labNitrit'),
        urinepH:      getLabValue('labUrinepH'),
        keton:        getLabValue('labKeton'),
        urineGlu:     getLabValue('labUrineGlu'),
        bloodCulture: getLabValue('labBloodCulture'),
        urineCulture: getLabValue('labUrineCulture'),
        sputum:       getLabValue('labSputum')
    };
}

// ==========================================
// CİNSİYET FİLTRE KONTROLÜ
// ==========================================

function shouldExcludeByGender(disease, gender) {
    const cfg = algorithmConfig.genderFilters;
    if (!cfg.enabled) return false;

    const cat = (disease.category || '').toLowerCase();
    const name = (disease.name || '').toLowerCase();
    const subcategory = (disease.subcategory || '').toLowerCase();

    if (gender === 'erkek') {
        // Jinekoloji kategorisi
        for (const excCat of cfg.maleExcludeCategories) {
            if (cat.includes(excCat.toLowerCase())) return true;
            if (subcategory.includes(excCat.toLowerCase())) return true;
        }
        // Anahtar kelimeler
        for (const kw of cfg.maleExcludeKeywords) {
            if (name.includes(kw.toLowerCase())) return true;
        }
        // disease.gender alanı kontrolü
        if (disease.gender && disease.gender === 'kadın') return true;
    }

    if (gender === 'kadın') {
        for (const excCat of cfg.femaleExcludeCategories) {
            if (cat.includes(excCat.toLowerCase())) return true;
        }
        for (const kw of cfg.femaleExcludeKeywords) {
            if (name.includes(kw.toLowerCase())) return true;
        }
        if (disease.gender && disease.gender === 'erkek') return true;
    }

    return false;
}

// ==========================================
// YAŞ FİLTRE KONTROLÜ
// ==========================================

function shouldExcludeByAge(disease, age) {
    const cfg = algorithmConfig.ageGroupFilters;
    if (!cfg.enabled) return false;

    const cat = (disease.category || '').toLowerCase();
    const name = (disease.name || '').toLowerCase();

    // disease.ageRange alanı varsa kesin filtre uygula
    if (disease.ageRange) {
        const min = typeof disease.ageRange.min !== 'undefined' ? disease.ageRange.min : 0;
        const max = typeof disease.ageRange.max !== 'undefined' ? disease.ageRange.max : 120;
        if (age < min || age > max) return true;
    }

    // Pediatrik-only hastalıklar
    if (age >= cfg.adultOnlyMinAge) {
        for (const c of cfg.pediatricOnlyCategories) {
            if (cat.includes(c.toLowerCase())) return true;
        }
        for (const kw of cfg.pediatricOnlyKeywords) {
            if (name.includes(kw.toLowerCase())) return true;
        }
    }

    // Sadece-erişkin hastalıklar
    if (age < cfg.adultOnlyMinAge) {
        for (const kw of cfg.adultOnlyKeywords) {
            if (name.includes(kw.toLowerCase())) return true;
        }
    }

    return false;
}

// ==========================================
// PREVALANS SKORU HESAPLAMA
// ==========================================

function calculatePrevalenceScore(disease, age, gender) {
    const scores = algorithmConfig.prevalenceScores;
    let score = scores[disease.prevalence] || scores.medium;

    // Yaş bazlı prevalans düzeltmeleri
    const adj = algorithmConfig.prevalenceAdjustments;

    // KVS için yaş bonusu
    if (adj.kardiyovaskulerAgeBonus) {
        const b = adj.kardiyovaskulerAgeBonus;
        if ((disease.category || '').includes(b.category.split(' ')[0]) && age >= b.minAge) {
            score = Math.min(100, score + b.bonus);
        }
    }

    // Pediatri için erişkin cezası
    if (adj.pediatriAdultPenalty) {
        const p = adj.pediatriAdultPenalty;
        if ((disease.category || '').includes('Pediatri') && age >= p.minAge) {
            score = p.score;
        }
    }

    return score;
}

// ==========================================
// SEMPTOM SKORU HESAPLAMA
// ==========================================

function calculateSymptomScore(disease, selectedSymptoms) {
    // veritabani.js'deki hastalıkların semptom formatını normalize et
    let diseaseSymptoms = [];

    if (disease.symptoms && Array.isArray(disease.symptoms)) {
        diseaseSymptoms = [...disease.symptoms];
    }
    if (disease.signs && Array.isArray(disease.signs)) {
        diseaseSymptoms = [...diseaseSymptoms, ...disease.signs];
    }

    if (diseaseSymptoms.length === 0) {
        return { score: 10, matched: [], unmatched: [] };
    }

    const lowerSelected = selectedSymptoms.map(s => s.toLowerCase());

    const matched = diseaseSymptoms.filter(s => {
        const sl = s.toLowerCase();
        return lowerSelected.some(sel => sel.includes(sl) || sl.includes(sel) || fuzzyMatch(sel, sl));
    });
    const unmatched = diseaseSymptoms.filter(s => !matched.includes(s));

    const score = (matched.length / diseaseSymptoms.length) * 100;
    return { score, matched, unmatched };
}

// Basit bulanık eşleşme
function fuzzyMatch(a, b) {
    if (a.length < 4 || b.length < 4) return false;
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    return longer.includes(shorter.substring(0, Math.min(shorter.length, 6)));
}

// ==========================================
// LAB SKORU HESAPLAMA
// ==========================================

function calculateLabScore(disease, labs) {
    const labDefs = disease.labs || disease.labFindings;

    // Eğer hastalıkta labs objesi (eski format: key-value) varsa
    if (labDefs && typeof labDefs === 'object' && !Array.isArray(labDefs)) {
        let totalWeight = 0;
        let matchedWeight = 0;
        const matchedLabs = [];

        Object.keys(labDefs).forEach(labKey => {
            const condition = labDefs[labKey];
            const labValue = labs[labKey];

            if (labValue !== null && labValue !== undefined) {
                const weight = condition.weight || 10;
                totalWeight += weight;
                let isMatch = false;
                const ref = getLabReference(labKey);

                if (condition.type === 'range') {
                    if (labValue >= condition.min && labValue <= condition.max) isMatch = true;
                } else if (condition.type === 'high') {
                    if (typeof labValue === 'number' && labValue > ref.max) isMatch = true;
                } else if (condition.type === 'low') {
                    if (typeof labValue === 'number' && labValue < ref.min) isMatch = true;
                } else if (condition.type === 'positive') {
                    if (labValue === 'pozitif' || labValue === 'positive' || labValue === '1+' ||
                        labValue === '2+' || labValue === '3+' || labValue === '4+') isMatch = true;
                } else if (condition.type === 'exact') {
                    if (labValue == condition.value) isMatch = true;
                }

                if (isMatch) {
                    matchedWeight += weight;
                    matchedLabs.push(`${condition.name || ref.name}: ${labValue}`);
                }
            }
        });

        const score = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 50;
        return { score, matchedLabs };
    }

    // Eğer labFindings string dizisi ise (yeni veritabanı formatı)
    // Bu durumda lab eşleşmesi manuel yapılamaz, nötr skor ver
    if (labDefs && Array.isArray(labDefs)) {
        // Metin bazlı eşleşme dene
        const matchedLabs = [];
        let hasAnyLabInput = Object.values(labs).some(v => v !== null && v !== undefined && v !== '');

        if (!hasAnyLabInput) return { score: 50, matchedLabs: [] };

        // Yüksek CRP → enflamasyon
        if (labs.crp !== null && labs.crp > 5) {
            const text = labDefs.join(' ').toLowerCase();
            if (text.includes('crp') || text.includes('enflamasyon') || text.includes('inflamasyon')) {
                matchedLabs.push('CRP yüksek');
            }
        }
        if (labs.wbc !== null && labs.wbc > 10) {
            const text = labDefs.join(' ').toLowerCase();
            if (text.includes('lökosit') || text.includes('wbc') || text.includes('lökositoz')) {
                matchedLabs.push('WBC yüksek (Lökositoz)');
            }
        }
        if (labs.hgb !== null && labs.hgb < 12) {
            const text = labDefs.join(' ').toLowerCase();
            if (text.includes('anemi') || text.includes('hemoglobin') || text.includes('hgb')) {
                matchedLabs.push('Hgb düşük (Anemi)');
            }
        }
        if (labs.glucose !== null && labs.glucose > 126) {
            const text = labDefs.join(' ').toLowerCase();
            if (text.includes('glukoz') || text.includes('hiperglisemi') || text.includes('diyabet')) {
                matchedLabs.push('Glukoz yüksek (Hiperglisemi)');
            }
        }
        if (labs.troponin !== null && labs.troponin > 0.014) {
            const text = labDefs.join(' ').toLowerCase();
            if (text.includes('troponin') || text.includes('miyokard')) {
                matchedLabs.push('Troponin yüksek');
            }
        }
        if (labs.creatinine !== null && labs.creatinine > 1.2) {
            const text = labDefs.join(' ').toLowerCase();
            if (text.includes('kreatinin') || text.includes('böbrek') || text.includes('renal')) {
                matchedLabs.push('Kreatinin yüksek');
            }
        }
        if (labs.tsh !== null && labs.tsh > 4.0) {
            const text = labDefs.join(' ').toLowerCase();
            if (text.includes('tsh') || text.includes('hipotiroidi') || text.includes('tiroid')) {
                matchedLabs.push('TSH yüksek (Hipotiroidi)');
            }
        }
        if (labs.tsh !== null && labs.tsh < 0.4) {
            const text = labDefs.join(' ').toLowerCase();
            if (text.includes('tsh') || text.includes('hipertiroidi') || text.includes('tiroid')) {
                matchedLabs.push('TSH düşük (Hipertiroidi)');
            }
        }

        const score = matchedLabs.length > 0 ? Math.min(100, matchedLabs.length * 25) : 50;
        return { score, matchedLabs };
    }

    return { score: 50, matchedLabs: [] };
}

// ==========================================
// ANAMNEZ ANALİZİ (METİNDEN SEMPTOM ÇIKARIMI)
// ==========================================

function extractSymptomsFromHistory() {
    const text = document.getElementById('patientHistory').value.toLowerCase();
    if (!text || text.length < 3) return;

    const allSymptoms = Object.values(symptomDatabase).flat();
    const foundSymptoms = [];

    // Direkt eşleşmeler
    allSymptoms.forEach(symptom => {
        if (text.includes(symptom.toLowerCase())) {
            foundSymptoms.push(symptom);
        }
    });

    // Eş anlamlı kontroller
    for (const [canonical, synonyms] of Object.entries(SYMPTOM_SYNONYMS)) {
        if (synonyms.some(s => text.includes(s))) {
            const fullSymptom = allSymptoms.find(s => s.toLowerCase().includes(canonical));
            if (fullSymptom && !foundSymptoms.includes(fullSymptom)) {
                foundSymptoms.push(fullSymptom);
            }
        }
    }

    // Yeni bulunanları seçili listeye ekle
    let newAdded = 0;
    foundSymptoms.forEach(sym => {
        if (!selectedSymptoms.includes(sym)) {
            selectedSymptoms.push(sym);
            newAdded++;
        }
    });

    if (newAdded > 0) {
        updateSelectedSymptoms();
        const activeSystem = document.querySelector('.system-tab.active')?.dataset?.system || 'GenelSistemik';
        renderSymptoms(activeSystem);
        console.log(`${newAdded} yeni semptom anamnezden çıkarıldı.`);
    }
}

// ==========================================
// ANA ALGORİTMA - TANI ANALİZİ
// ==========================================

function analyzeCase() {
    // Config'i yenile (admin değişikliklerine duyarlı)
    algorithmConfig = loadAlgorithmConfig();

    // 1. Hasta verilerini topla
    const age = parseInt(document.getElementById('patientAge').value);
    const gender = document.getElementById('patientGender').value;

    // Validasyon
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

    // Anamnezden otomatik çıkarım
    extractSymptomsFromHistory();

    if (selectedSymptoms.length === 0) {
        if (!confirm('Hiç semptom seçilmedi. Sadece yaş/cinsiyet ve lab verilerine göre genel tarama yapılacak. Devam edilsin mi?')) {
            return;
        }
    }

    // 2. Lab değerlerini topla
    const labs = collectLabValues();

    // 3. Görüntüleme ve patoloji metinleri
    const imagingText   = (document.getElementById('imagingResults')?.value || '').toLowerCase();
    const pathologyText = (document.getElementById('pathologyResults')?.value || '').toLowerCase();

    // 4. Yükleme ekranı
    document.getElementById('loadingSection').classList.add('active');
    document.getElementById('resultsSection').classList.remove('active');

    // 5. Analiz (kısa gecikme ile UX iyileştirme)
    setTimeout(() => {
        const results = [];
        const cfg = algorithmConfig;

        // Admin tarafından değiştirilen hastalık veritabanı overridelerini uygula
        const effectiveDB = applyDatabaseOverrides(diseaseDatabase);

        effectiveDB.forEach(disease => {
            // A. CİNSİYET FİLTRESİ
            if (shouldExcludeByGender(disease, gender)) return;

            // B. YAŞ FİLTRESİ
            if (shouldExcludeByAge(disease, age)) return;

            // C. SEMPTOM SKORU (%50)
            const { score: symptomScore, matched: matchedSymptoms, unmatched: unmatchedSymptoms } =
                calculateSymptomScore(disease, selectedSymptoms);

            // D. PREVALANS SKORU (%30)
            const prevalenceScore = calculatePrevalenceScore(disease, age, gender);
            const prevalenceLabel = disease.prevalence || 'medium';

            // E. LAB SKORU (%20)
            const { score: labScore, matchedLabs } = calculateLabScore(disease, labs);

            // F. GÖRÜNTÜLEME/PATOLOJİ BONUSU (max +10)
            let imagingBonus = 0;
            if ((disease.pathology || []).length > 0 && pathologyText.length > 3) {
                const hasMatch = (disease.pathology || []).some(p => pathologyText.includes(p.toLowerCase().substring(0, 6)));
                if (hasMatch) imagingBonus += 5;
            }

            // G. TOPLAM SKOR
            const totalScore = Math.min(100,
                (symptomScore   * cfg.symptomWeight) +
                (prevalenceScore * cfg.prevalenceWeight) +
                (labScore       * cfg.labWeight) +
                imagingBonus
            );

            // H. EŞİK KONTROLÜ
            if (totalScore > cfg.minTotalScore ||
                (disease.prevalence === 'high' && symptomScore > 20)) {
                results.push({
                    disease,
                    totalScore,
                    symptomScore,
                    prevalenceScore,
                    labScore,
                    matchedSymptoms,
                    unmatchedSymptoms,
                    matchedLabs,
                    prevalenceLabel
                });
            }
        });

        // Sıralama
        results.sort((a, b) => {
            if (Math.abs(b.totalScore - a.totalScore) > 0.5) return b.totalScore - a.totalScore;
            return b.prevalenceScore - a.prevalenceScore;
        });

        // Sonuçları göster
        displayResults(results.slice(0, cfg.maxResults));

        document.getElementById('loadingSection').classList.remove('active');
        document.getElementById('resultsSection').classList.add('active');
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

    }, 800);
}

// Admin değişikliklerini veritabanına uygula
function applyDatabaseOverrides(baseDB) {
    try {
        // Silinen hastalıklar
        const deleted = JSON.parse(localStorage.getItem('adminDeletedIds') || '[]');
        // Eklenen hastalıklar
        const added = JSON.parse(localStorage.getItem('adminAddedDiseases') || '[]');
        // Değiştirilen hastalıklar
        const modified = JSON.parse(localStorage.getItem('adminModifiedDiseases') || '{}');

        let result = baseDB
            .filter(d => !deleted.includes(d.id || d.name))
            .map(d => {
                const key = d.id || d.name;
                if (modified[key]) {
                    return Object.assign({}, d, modified[key]);
                }
                return d;
            });

        result = [...result, ...added];
        return result;
    } catch(e) {
        return baseDB;
    }
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
                <div>Seçili semptomlar ve demografik verilerle eşleşen hastalık bulunamadı.
                     Lütfen semptomları genişletin veya filtreleri kontrol edin.</div>
            </div>`;
        return;
    }

    results.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'disease-item';

        if (result.totalScore >= 70)           item.classList.add('high-probability');
        else if (result.totalScore >= 40)      item.classList.add('medium-probability');
        else if (result.prevalenceLabel === 'rare') item.classList.add('rare');
        else                                   item.classList.add('low-probability');

        const prevBadgeClass = { high: 'prev-high', medium: 'prev-medium', low: 'prev-low', rare: 'prev-rare' }[result.prevalenceLabel] || 'prev-medium';
        const prevText = { high: 'Yaygın', medium: 'Orta Sıklık', low: 'Nadir', rare: 'Çok Nadir' }[result.prevalenceLabel] || 'Orta';

        const diseaseCode = result.disease.code || result.disease.id || 'Kod Yok';
        const category    = result.disease.category || '';
        const englishName = result.disease.englishName ? `<span style="color:var(--secondary); font-size:0.9rem; font-style:italic;"> / ${result.disease.englishName}</span>` : '';

        item.innerHTML = `
            <div class="disease-header">
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <span class="disease-name">${result.disease.name}${englishName}</span>
                    <span class="disease-code">${diseaseCode}</span>
                    <span class="prevalence-badge ${prevBadgeClass}">${prevText}</span>
                    ${category ? `<span class="badge" style="background:#e0e7ff; color:#3730a3;">${category}</span>` : ''}
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.5rem; font-weight:800; color:var(--primary);">${result.totalScore.toFixed(1)}%</div>
                    <div style="font-size:0.75rem; color:var(--secondary);">Eşleşme Skoru</div>
                </div>
            </div>

            <div class="match-score">
                <div class="score-bar">
                    <div class="score-fill" style="width:${Math.min(100, result.totalScore)}%"></div>
                </div>
            </div>

            <div class="score-breakdown">
                <span title="Semptom Uyumu">🩺 Semptom: ${result.symptomScore.toFixed(0)}%</span>
                <span title="Prevalans Ağırlığı">📊 Prevalans: ${result.prevalenceScore.toFixed(0)}%</span>
                <span title="Lab Uyumu">🧪 Lab: ${result.labScore.toFixed(0)}%</span>
                <span style="margin-left:auto; color:${result.matchedSymptoms.length > 0 ? 'var(--success)' : 'var(--secondary)'};">
                    ✓ ${result.matchedSymptoms.length} / ${result.matchedSymptoms.length + result.unmatchedSymptoms.length} semptom
                </span>
            </div>

            <div class="disease-details" id="details-${index}">
                <div class="detail-section">
                    <div class="detail-label">🩺 Eşleşen Semptomlar (${result.matchedSymptoms.length}):</div>
                    <div>
                        ${result.matchedSymptoms.length > 0
                            ? result.matchedSymptoms.map(s => `<span class="badge matched">${s}</span>`).join('')
                            : '<span style="color:var(--secondary); font-style:italic;">Eşleşen semptom bulunamadı</span>'
                        }
                    </div>
                </div>

                ${result.unmatchedSymptoms.length > 0 ? `
                <div class="detail-section">
                    <div class="detail-label">⏳ Bu Hastalıkta Beklenen Ancak Seçilmeyen Semptomlar:</div>
                    <div>
                        ${result.unmatchedSymptoms.slice(0, 5).map(s => `<span class="badge">${s}</span>`).join('')}
                        ${result.unmatchedSymptoms.length > 5 ? `<span class="badge">+${result.unmatchedSymptoms.length - 5} daha...</span>` : ''}
                    </div>
                </div>` : ''}

                ${result.matchedLabs.length > 0 ? `
                <div class="detail-section">
                    <div class="detail-label">🧪 Eşleşen Laboratuvar Bulguları:</div>
                    <div>${result.matchedLabs.map(l => `<span class="badge matched-lab">${l}</span>`).join('')}</div>
                </div>` : ''}

                ${result.disease.treatment ? `
                <div class="detail-section">
                    <div class="detail-label">💊 Tedavi Yaklaşımı:</div>
                    <div style="color:var(--secondary); font-size:0.875rem;">
                        ${Array.isArray(result.disease.treatment)
                            ? result.disease.treatment.join(' • ')
                            : result.disease.treatment}
                    </div>
                </div>` : ''}

                ${result.disease.ageRange ? `
                <div class="detail-section">
                    <div class="detail-label">👤 Tipik Demografik:</div>
                    <div style="color:var(--secondary);">
                        Yaş: ${result.disease.ageRange.min}-${result.disease.ageRange.max}
                        ${result.disease.gender && result.disease.gender !== 'both'
                            ? ` • ${result.disease.gender === 'erkek' ? 'Erkek' : 'Kadın'}` : ' • Her iki cinsiyet'}
                    </div>
                </div>` : ''}
            </div>

            <div onclick="toggleDetails(${index})"
                 style="text-align:center; margin-top:0.75rem; color:var(--primary); font-size:0.875rem; font-weight:600; cursor:pointer; user-select:none;">
                ▾ Detayları Göster / Gizle ▾
            </div>
        `;

        container.appendChild(item);
    });
}

function toggleDetails(index) {
    const details = document.getElementById(`details-${index}`);
    if (details) details.classList.toggle('show');
}