// 印尼语词 → OpenMoji 码位。键一律小写、去空白。
// 覆盖不全是预期的：抽象词没有对应图形，由 THEME_EMOJI 兜底。
export const WORD_EMOJI = {
  // 水果
  apel: '1F34E', pisang: '1F34C', jeruk: '1F34A', mangga: '1F96D',
  semangka: '1F349', anggur: '1F347', nanas: '1F34D', melon: '1F348',
  stroberi: '1F353', kelapa: '1F965', alpukat: '1F951',
  'air kelapa': '1F965', 'jus alpukat': '1F951',

  // 蔬菜
  wortel: '1F955', bayam: '1F96C', kangkung: '1F96C', sawi: '1F96C',
  tomat: '1F345', timun: '1F952', terong: '1F346', bawang: '1F9C5',
  jagung: '1F33D', kentang: '1F954', jamur: '1F344', sayur: '1F96C',
  'kentang goreng': '1F35F',

  // 肉蛋豆与海鲜
  daging: '1F356', ayam: '1F414', sapi: '1F404', kambing: '1F410',
  babi: '1F416', telur: '1F95A', kacang: '1F95C', ikan: '1F41F',
  udang: '1F990', cumi: '1F991', kepiting: '1F980', kerang: '1F9AA',
  lele: '1F41F', teri: '1F41F', 'ikan tuna': '1F41F',
  'ikan bandeng': '1F41F', 'ayam betina': '1F414',

  // 主食与菜肴
  nasi: '1F35A', roti: '1F35E', mi: '1F35C', bubur: '1F35A',
  'nasi goreng': '1F35A', 'mi goreng': '1F35C', sate: '1F362',
  rendang: '1F35B', soto: '1F372', 'gado-gado': '1F957', bakso: '1F35C',
  sambal: '1F336', kerupuk: '1F958', 'nasi padang': '1F35A',
  'nasi uduk': '1F35A', 'bubur ayam': '1F35A', 'telur dadar': '1F373',
  'roti bakar': '1F35E', 'roti manis': '1F35E', sereal: '1F963',

  // 甜点小吃
  kue: '1F370', permen: '1F36C', cokelat: '1F36B', 'es krim': '1F368',
  puding: '1F36E', biskuit: '1F36A', donat: '1F369', martabak: '1F95E',
  'pisang goreng': '1F34C', gorengan: '1F35F', selai: '1F36F',

  // 饮料
  air: '1F4A7', teh: '1F375', kopi: '2615', susu: '1F95B', jus: '1F9C3',
  es: '1F9CA', minuman: '1F964', 'air mineral': '1F4A7',
  'cokelat panas': '2615', 'susu kedelai': '1F95B', 'es teh': '1F9CA',
  'teh hangat': '1F375', 'es jeruk': '1F34A', 'kopi hitam': '2615',
  'es kelapa': '1F965', 'susu cokelat': '1F95B', 'kopi susu': '2615',

  // 调料
  garam: '1F9C2', gula: '1F36C', minyak: '1FAD2', kecap: '1F376',
  merica: '1F9C2', cabai: '1F336', jahe: '1FADA', bumbu: '1F9C2',

  // 身体
  kepala: '1F9D1', mata: '1F441', hidung: '1F443', mulut: '1F444',
  telinga: '1F442', tangan: '270B', kaki: '1F9B6', rambut: '1F9B0',
  gigi: '1F9B7', lutut: '1F9B5', jari: '1F446', kuku: '1F485',
  lidah: '1F445',

  // 房子与家具
  rumah: '1F3E0', kamar: '1F6CF', dapur: '1F373', 'kamar mandi': '1F6C1',
  pintu: '1F6AA', kunci: '1F511', jendela: '1FA9F', dinding: '1F9F1',
  keran: '1F6B0', kursi: '1FA91', 'tempat tidur': '1F6CF',
  cermin: '1FA9E', bantal: '1F6CF', sofa: '1F6CB', kasur: '1F6CF',
  'kursi panjang': '1F6CB', 'jam dinding': '1F553', lukisan: '1F5BC',
  'vas bunga': '1F3FA', pagar: '1F9F1', tangga: '1FA9C',

  // 电器与数码
  televisi: '1F4FA', lampu: '1F4A1', colokan: '1F50C', listrik: '26A1',
  komputer: '1F4BB', telepon: '1F4DE', layar: '1F4F1', baterai: '1F50B',
  kamera: '1F4F7', foto: '1F4F7', video: '1F3AC', remote: '1F4FA',
  'kamera foto': '1F4F7', 'panggilan video': '1F4F9',

  // 网络
  internet: '1F310', wifi: '1F4F6', 'kata sandi': '1F511', akun: '1F464',
  unduh: '2B07', unggah: '2B06', situs: '1F310', sinyal: '1F4F6',
  kuota: '1F4F6', aplikasi: '1F4F1', grup: '1F465', teman: '1F465',
  komentar: '1F4AC', pesan: '1F4AC', mengobrol: '1F4AC',

  // 衣物
  baju: '1F455', celana: '1F456', rok: '1F457', sepatu: '1F45F',
  sandal: '1FA74', 'kaus kaki': '1F9E6', topi: '1F9E2', jaket: '1F9E5',
  kerudung: '1F9D5', piyama: '1F45A',

  // 动物
  kucing: '1F408', anjing: '1F415', kelinci: '1F407', burung: '1F426',
  bebek: '1F986', kerbau: '1F403', harimau: '1F405', gajah: '1F418',
  monyet: '1F412', ular: '1F40D', buaya: '1F40A', orangutan: '1F98D',
  rusa: '1F98C', kadal: '1F98E', katak: '1F438', kera: '1F412',

  // 昆虫
  nyamuk: '1F99F', semut: '1F41C', 'laba-laba': '1F577',
  'kupu-kupu': '1F98B', lebah: '1F41D', serangga: '1F41B',

  // 自然与天气
  gunung: '26F0', pantai: '1F3D6', hutan: '1F332', pohon: '1F333',
  bunga: '1F338', daun: '1F343', batu: '1FAA8', langit: '2601',
  laut: '1F30A', hujan: '1F327', angin: '1F32C', mendung: '2601',
  petir: '26A1', banjir: '1F30A', panas: '1F525', dingin: '2744',
  cuaca: '2600', musim: '1F343',

  // 交通
  mobil: '1F697', motor: '1F3CD', sepeda: '1F6B2', bus: '1F68C',
  kereta: '1F686', pesawat: '2708', kapal: '1F6A2', ojek: '1F3CD',
  taksi: '1F695', jembatan: '1F309', 'lampu merah': '1F6A6',
  bandara: '2708', stasiun: '1F686', 'jalan kaki': '1F6B6',
  tiket: '1F3AB', 'tiket masuk': '1F3AB', koper: '1F9F3', peta: '1F5FA',

  // 学校与办公
  sekolah: '1F3EB', buku: '1F4D6', pensil: '270F', pulpen: '1F58A',
  'tas sekolah': '1F392', murid: '1F9D1', guru: '1F9D1', kelas: '1F3EB',
  kantor: '1F3E2', rapat: '1F4CB', berkas: '1F4C1', gaji: '1F4B0',
  ujian: '1F4DD', tugas: '1F4DD', membaca: '1F4D6', menulis: '270D',
  'membaca buku': '1F4D6',

  // 钱与场所
  uang: '1F4B5', rupiah: '1F4B5', tunai: '1F4B5', kartu: '1F4B3',
  dompet: '1F45B', atm: '1F3E7', bank: '1F3E6', 'kartu debit': '1F4B3',
  toko: '1F3EA', pasar: '1F3EA', supermarket: '1F3EA', mal: '1F3EC',
  gereja: '26EA', masjid: '1F54C', 'kantor pos': '1F3E4',
  perpustakaan: '1F4DA', restoran: '1F37D', kafe: '2615',
  bioskop: '1F3AC', hotel: '1F3E8', 'rumah sakit': '1F3E5',
  apotek: '1F48A', taman: '1F333', kota: '1F3D9', desa: '1F3D8',
  gedung: '1F3E2', warung: '1F3EA', keranjang: '1F9FA',

  // 医疗
  obat: '1F48A', tablet: '1F48A', vitamin: '1F48A', perban: '1FA79',
  plester: '1FA79', masker: '1F637', dokter: '1F9D1', perawat: '1F9D1',
  suntik: '1F489', demam: '1F912', pilek: '1F927', 'sakit kepala': '1F915',
  mual: '1F922', pusing: '1F635', luka: '1FA79', pasien: '1F912',
  'sirop obat': '1F48A',

  // 情绪
  senang: '1F60A', sedih: '1F622', marah: '1F620', takut: '1F628',
  kaget: '1F632', kecewa: '1F61E', khawatir: '1F61F', gembira: '1F604',
  menangis: '1F62D', lucu: '1F602',

  // 厨房用具
  pisau: '1F52A', sendok: '1F944', garpu: '1F374', panci: '1F372',
  wajan: '1F373', kompor: '1F373', gunting: '2702', piring: '1F37D',
  gelas: '1F964', mangkuk: '1F963', botol: '1F37C', kotak: '1F4E6',
  kertas: '1F4C4', bungkus: '1F4E6',

  // 时间
  jam: '1F551', pagi: '1F305', siang: '2600', malam: '1F319',
  hari: '1F4C5', tanggal: '1F4C5', bulan: '1F4C6', tahun: '1F4C5',
  menit: '1F553', 'jam tangan': '231A',

  // 运动与爱好
  'sepak bola': '26BD', 'bulu tangkis': '1F3F8', 'bola basket': '1F3C0',
  berenang: '1F3CA', 'lari pagi': '1F3C3', olahraga: '1F3C3',
  pertandingan: '1F3C6', musik: '1F3B5', lagu: '1F3B6',
  menyanyi: '1F3A4', gitar: '1F3B8', menggambar: '1F3A8',
  memasak: '1F373', berkebun: '1F331', 'menonton film': '1F3AC',

  // 节日与家事
  natal: '1F384', 'tahun baru': '1F386', imlek: '1F9E7',
  'kembang api': '1F386', hadiah: '1F381', 'kue ulang tahun': '1F382',
  pesta: '1F389', 'ulang tahun': '1F382', pernikahan: '1F492',
  undangan: '1F48C', doa: '1F64F', tamu: '1F465',

  // 婴幼
  bayi: '1F476', 'botol susu': '1F37C', stroller: '1F6BC',
  mainan: '1F9F8', balita: '1F476',

  // 安全
  bahaya: '26A0', awas: '26A0', dilarang: '1F6AB', kecelakaan: '1F691',
  kebakaran: '1F525', ambulans: '1F691', polisi: '1F46E',

  // 清洁卫浴
  sabun: '1F9FC', 'sikat gigi': '1FAA5', 'pasta gigi': '1FAA5',
  ember: '1FAA3', tisu: '1F9FB', sapu: '1F9F9',
  'tempat sampah': '1F5D1', sampah: '1F5D1', 'sapu lidi': '1F9F9',

  // 材料与形状
  kayu: '1FAB5', besi: '1F529', kain: '1F9F5', 'batu bata': '1F9F1',
  bambu: '1F38D', bulat: '26AA', persegi: '2B1C', segitiga: '1F53A',
  lingkaran: '2B55',

  // 颜色
  merah: '1F534', biru: '1F535', kuning: '1F7E1', hijau: '1F7E2',
  hitam: '26AB', putih: '26AA', oranye: '1F7E0', ungu: '1F7E3',
  emas: '1F947', perak: '1F948', warna: '1F3A8',

  // 方位
  atas: '2B06', bawah: '2B07', kiri: '2B05', kanan: '27A1',
  arah: '27A1',

  // 随身物品
  tas: '1F45C', payung: '2602', kacamata: '1F453', senter: '1F526',
  'kartu identitas': '1F194', 'botol minum': '1F37C',
  paket: '1F4E6', surat: '2709', amplop: '2709', perangko: '1F4EE',
  'korek api': '1F525', 'sapu tangan': '1F9FB',

  // 家人称谓
  ayah: '1F468', ibu: '1F469', kakak: '1F9D1', adik: '1F9D2',
  kakek: '1F474', nenek: '1F475', anak: '1F9D2', suami: '1F935',
  istri: '1F470', keluarga: '1F46A',

  // 问候与礼貌
  halo: '1F44B', 'selamat pagi': '1F305', 'selamat siang': '2600',
  'selamat sore': '1F307', 'selamat malam': '1F319', 'apa kabar': '1F44B',
  'sampai jumpa': '1F44B', 'salam kenal': '1F91D', 'hati-hati': '26A0',
  'selamat datang': '1F44B', tolong: '1F64F', silakan: '1F450',
  'terima kasih': '1F64F', maaf: '1F647', permisi: '1F64F',
  selamat: '1F389', merayakan: '1F389',

  // 判断
  ya: '2705', tidak: '274C', bukan: '274C', benar: '2705',
  salah: '274C', betul: '2705', cukup: '2705', matang: '2705',
  halal: '2705',

  // 日常动作
  makan: '1F374', minum: '1F964', tidur: '1F634', bangun: '23F0',
  duduk: '1FA91', berdiri: '1F9CD', berjalan: '1F6B6', berlari: '1F3C3',
  mandi: '1F6C1', pulang: '1F3E0', 'jalan-jalan': '1F6B6',

  // 家务
  menyapu: '1F9F9', mengepel: '1F9F9', mencuci: '1F9FC',
  menjemur: '1F31E', melipat: '1F455', membuang: '1F5D1',
  merapikan: '1F9F9', membersihkan: '1F9FC', pel: '1F9F9',
  lap: '1F9FB', sikat: '1FAA5', kemoceng: '1F9F9', rapi: '2728',
  sampo: '1F9F4', handuk: '1F9FB', gayung: '1FAA3', deterjen: '1F9F4',

  // 时间
  sore: '1F307', 'hari ini': '1F4C5', besok: '1F4C5', kemarin: '1F4C5',
  sekarang: '23F0', nanti: '1F553', tadi: '1F553', detik: '23F1',
  senin: '1F4C5', selasa: '1F4C5', rabu: '1F4C5', kamis: '1F4C5',
  jumat: '1F4C5', sabtu: '1F4C5', minggu: '1F4C5',
  'akhir pekan': '1F4C5', 'hari kerja': '1F4BC', 'minggu depan': '1F4C5',
  januari: '1F4C6', februari: '1F4C6', maret: '1F4C6', april: '1F4C6',
  mei: '1F4C6', juni: '1F4C6', juli: '1F4C6', agustus: '1F4C6',
  september: '1F4C6', oktober: '1F4C6', november: '1F4C6',
  desember: '1F4C6', abad: '1F570',

  // 数量
  banyak: '1F522', sedikit: '1F522', penuh: '1F964', semua: '1F522',
  kurang: '1F522', jumlah: '1F522', seratus: '1F522', seribu: '1F522',
  sejuta: '1F522', nol: '1F522', setengah: '1F522',
  'sepuluh ribu': '1F522', 'dua puluh lima': '1F522',
  'tiga puluh': '1F522', 'lima puluh': '1F522', 'dua ratus': '1F522',

  // 购物
  beli: '1F6D2', jual: '1F3EA', harga: '1F4B0', murah: '1F4B0',
  mahal: '1F4B0', diskon: '1F3F7', tawar: '1F4AC', bayar: '1F4B3',
  kembalian: '1F4B5', struk: '1F9FE', kasir: '1F4B3',
  penjual: '1F9D1', pembeli: '1F9D1', belanja: '1F6D2',
  transfer: '1F4B8', saldo: '1F4B0',

  // 学习与工作
  'papan tulis': '1F4CB', belajar: '1F4DA', mengajar: '1F9D1',
  bertanya: '2753', menjawab: '1F4AC', mengerti: '1F4A1',
  menghafal: '1F9E0', bekerja: '1F4BC', atasan: '1F9D1',
  'rekan kerja': '1F465', cuti: '1F334', pekerjaan: '1F4BC',
  petani: '1F9D1', nelayan: '1F3A3', pedagang: '1F3EA',
  sopir: '1F697', insinyur: '1F477', pendeta: '26EA',

  // 医疗与身体状态
  puskesmas: '1F3E5', berobat: '1F3E5', resep: '1F4DD',
  sembuh: '1F49A', sehat: '1F4AA', sakit: '1F912', lelah: '1F62B',
  lapar: '1F35A', haus: '1F4A7', kenyang: '1F60B',
  mengantuk: '1F634', kuat: '1F4AA', lemah: '1F615',
  istirahat: '1F634', batuk: '1F927', 'sakit perut': '1F922',
  alergi: '1F927', salep: '1F9F4', leher: '1F9CD', bahu: '1F9CD',
  punggung: '1F9CD', dada: '1F9CD', pinggang: '1F9CD', siku: '1F4AA',

  // 性格与感受
  baik: '1F60A', ramah: '1F60A', sabar: '1F60C', rajin: '1F4AA',
  malas: '1F634', jujur: '1F91D', sombong: '1F60F', pemalu: '1F633',
  tenang: '1F60C', bosan: '1F644', perasaan: '1F4AD',

  // 味道
  manis: '1F36C', asin: '1F9C2', asam: '1F34B', pedas: '1F336',
  pahit: '1F922', enak: '1F60B', rasa: '1F444', segar: '1F4A7',
  'manis sekali': '1F36C', 'kurang manis': '1F36C',
  'pedas sedikit': '1F336',

  // 自然
  sungai: '1F30A', tanah: '1F30D', cerah: '2600',
  lalat: '1FAB0', kecoa: '1FAB3', cacing: '1FAB1', kutu: '1F41B',

  // 性状
  besar: '1F4CF', kecil: '1F4CF', panjang: '1F4CF', pendek: '1F4CF',
  tinggi: '1F4CF', rendah: '1F4CF', lebar: '1F4CF', sempit: '1F4CF',
  tebal: '1F4CF', tipis: '1F4CF', lurus: '1F4CF', baru: '2728',
  lama: '1F570', cepat: '1F4A8', lambat: '1F40C', bersih: '2728',
  kotor: '1F9F9', berat: '1F3CB', keras: '1FAA8',
  bengkok: '3030', miring: '1F4D0', garis: '3030', sudut: '1F4D0',
  bentuk: '1F537',

  // 材料
  plastik: '1F9F4', kaca: '1FA9F', semen: '1F9F1', kulit: '1F45C',

  // 家中区域与陈设
  'ruang tamu': '1F6CB', teras: '1F3E1', halaman: '1F333',
  garasi: '1F697', gudang: '1F4E6', lantai: '1F9F1',
  lemari: '1F5C4', rak: '1F5C4', laci: '1F5C4', seprai: '1F6CF',
  selimut: '1F6CF', guling: '1F6CF', kelambu: '1F6CF',
  'gantungan baju': '1F45A', 'meja rias': '1FA9E', gorden: '1FA9F',
  'meja tamu': '1F6CB', asbak: '1F6AC', 'foto keluarga': '1F5BC',
  hiasan: '1F3AD', gerbang: '1F6AA', bel: '1F514', atap: '1F3E0',
  selokan: '1F4A7', seragam: '1F455', 'rice cooker': '1F35A',
  'kipas angin': '1F32C', kantong: '1F6CD', sedotan: '1F964',
  talenan: '1FAB5', spatula: '1F373', saringan: '1F373',

  // 蔬果补充
  kubis: '1F96C', 'daun bawang': '1F9C5', seledri: '1F96C',
  'kacang panjang': '1F96C', pare: '1F96C', toge: '1F96C',
  jambu: '1F34E', nangka: '1F34D', kunyit: '1F7E1', santan: '1F965',

  // 小吃与餐厅
  klepon: '1F361', 'tahu isi': '1F35F', siomay: '1F95F',
  batagor: '1F35F', bakwan: '1F35F', cireng: '1F35F',
  jajanan: '1F36C', 'pedagang kaki lima': '1F3EA', lontong: '1F35A',
  'sarapan pagi': '1F373', 'warung sarapan': '1F3EA',
  sarapan: '1F373', menu: '1F4CB', memesan: '1F4DD', porsi: '1F37D',
  pelayan: '1F9D1', 'makan di tempat': '1F37D', 'minta bon': '1F9FE',
  'meja untuk dua': '1F37D', 'tanpa es': '1F6AB',

  // 烹饪动作
  menggoreng: '1F373', merebus: '1F372', mengukus: '1F372',
  membakar: '1F525', menumis: '1F373', memotong: '1F52A',
  mengaduk: '1F944', mengupas: '1F52A', mencampur: '1F944',

  // 出行
  becak: '1F6B2', jalan: '1F6E3', halte: '1F68F', terminal: '1F68F',
  pelabuhan: '2693', perempatan: '1F6A6', macet: '1F697',
  naik: '2B06', turun: '2B07', berangkat: '1F6EB', tiba: '1F6EC',
  menunggu: '23F3', penumpang: '1F9D1', antar: '1F697',
  jemput: '1F697', penginapan: '1F3E8', menginap: '1F6CF',
  resepsionis: '1F6CE', 'kamar mandi dalam': '1F6C1',
  'pesan kamar': '1F4C5', 'kunci kamar': '1F511', 'check-out': '1F6AA',
  'penginapan murah': '1F3E8', trotoar: '1F6B6', 'lalu lintas': '1F6A6',
  kampung: '1F3D8', alamat: '1F4EE', ramai: '1F465',
  'kantor polisi': '1F694', 'toilet umum': '1F6BB',

  // 问路
  'di mana': '2753', 'ke mana': '2753', siapa: '2753', apa: '2753',
  kapan: '2753', berapa: '2753', mengapa: '2753', bagaimana: '2753',
  'yang mana': '2753', kenapa: '2753', apakah: '2753',
  'berapa lama': '2753', 'berapa jauh': '1F4CF',
  belok: '1F500', 'lurus terus': '2B06', 'sebelah kiri': '2B05',
  tersesat: '1F615', melewati: '27A1',

  // 银行邮寄
  rekening: '1F3E6', 'buku tabungan': '1F4D2', menabung: '1F4B0',
  'menarik uang': '1F3E7', setor: '1F3E6', teller: '1F9D1',
  'bunga bank': '1F4C8', antrean: '1F9CD', antre: '1F9CD',
  kurir: '1F69A', resi: '1F9FE', 'ongkos kirim': '1F4B5',
  mengirim: '1F4E4', menerima: '1F4E5', penerima: '1F9D1',

  // 手机社交
  cas: '1F50C', 'nada dering': '1F514', daftar: '1F4DD',
  membalas: '1F4E9', membagikan: '1F501', menyukai: '2764',

  // 婴幼与家事
  popok: '1F476', menyusui: '1F931', menggendong: '1F476',
  'bedak bayi': '1F476',

  // 爱好运动旅游
  hobi: '1F3B5', lapangan: '1F3DF', menang: '1F3C6', kalah: '1F614',
  wisata: '1F5FA', liburan: '1F3D6', pemandangan: '1F304',
  candi: '1F6D5', 'oleh-oleh': '1F381', pemandu: '1F9D1',

  // 安全
  aman: '1F6E1', darurat: '1F6A8',

  // 感官
  melihat: '1F441', mendengar: '1F442', mencium: '1F443',
  merasa: '1F91A', menyentuh: '1F446', suara: '1F50A', bau: '1F443',
  wangi: '1F338', 'terang benderang': '1F4A1', sunyi: '1F92B',
  terang: '1F4A1', gelap: '1F311',

  // 节日
  lebaran: '1F54C', 'hari kemerdekaan': '1F389', mudik: '1F697',
  'libur nasional': '1F4C5', tradisi: '1F3AD', perayaan: '1F389',

  // 常用动词与情态
  mau: '1F4AD', ingin: '2B50', harus: '2757', bisa: '2705',
  perlu: '2757', suka: '2764', coba: '1F9EA', jangan: '1F6AB',
  sebaiknya: '1F4A1', mengambil: '1F91A', meletakkan: '1F91A',
  membuka: '1F513', menutup: '1F512', menyalakan: '1F4A1',
  mematikan: '1F50C', memberi: '1F381', membawa: '1F45C',
  meminjam: '1F91D', berbicara: '1F5E3', bertemu: '1F91D',
  membantu: '1F91D', mencari: '1F50D', menemukan: '1F389',
  memakai: '1F455', berhenti: '1F6D1', mulai: '25B6',
  selesai: '2705', tutup: '1F512', masuk: '1F513',

  // —— 中级：人际与年龄 ——
  kerabat: '1F46A', sahabat: '1F91D', tetangga: '1F3E1', kenalan: '1F44B',
  sepupu: '1F46B', keponakan: '1F9D2', mertua: '1F475', menantu: '1F470',
  ipar: '1F46C', akrab: '1F46B',
  usia: '1F382', remaja: '1F9D2', dewasa: '1F9D1', pemuda: '1F468',
  lansia: '1F9D3', 'paruh baya': '1F9D4', sebaya: '1F46B', generasi: '1F46A',
  angkatan: '1F393', kelahiran: '1F476',

  // —— 中级：性格与情绪 ——
  tulus: '1F49D', angkuh: '1F60F', pelit: '1F4B0', 'murah hati': '1F381',
  cuek: '1F612', tegas: '270A', 'keras kepala': '1F5FF', teliti: '1F50E',
  ceroboh: '1F643', pendiam: '1F910',
  kesal: '1F624', cemas: '1F630', gugup: '1F628', lega: '1F60C',
  terharu: '1F972', rindu: '1F97A', jenuh: '1F644', bangga: '1F60E',
  iri: '1F612', tersinggung: '1F620',

  // —— 中级：交流与语气 ——
  berbincang: '1F5E3', berdiskusi: '1F4AC', menjelaskan: '1F4D6',
  menyampaikan: '1F4E8', mendengarkan: '1F442', berdebat: '1F5EF',
  menolak: '1F645', memuji: '1F44F', menegur: '261D', curhat: '1F62D',
  sopan: '1F647', bercanda: '1F602', berbisik: '1F92B', berteriak: '1F4E2',
  'terus terang': '1F5E8', 'basa-basi': '1F44B', sindiran: '1F60F',
  serius: '1F610', 'ragu-ragu': '1F914', santai: '1F60C',

  // —— 中级：时间与频率 ——
  jadwal: '1F4C5', 'janji temu': '1F4C6', menunda: '23F3',
  'tepat waktu': '23F0', mendadak: '26A1', sementara: '1F551',
  berlangsung: '25B6', 'tenggat waktu': '1F6A9', 'waktu luang': '1F6CB',
  mempercepat: '23E9',
  biasanya: '1F504', sesekali: '1F503', rutin: '1F501', berkala: '1F4C5',
  'terus-menerus': '267E', kerap: '1F502', 'sewaktu-waktu': '1F550',
  'berulang kali': '1F501', 'sekali seminggu': '1F4C5',
  'hampir tidak pernah': '1F6AB',

  // —— 中级：职场 ——
  karyawan: '1F9D1', jabatan: '1F4BC', lamaran: '1F4C4', wawancara: '1F4AC',
  kontrak: '1F4DC', izin: '1F4DD', absen: '1F4CB', divisi: '1F3E2',
  promosi: '1F4C8', tunjangan: '1F4B0',
  mengerjakan: '1F4BB', menyelesaikan: '2705', kemajuan: '1F4C8',
  revisi: '270F', tertunda: '23F3', target: '1F3AF', prioritas: '2757',
  menyerahkan: '1F4E4', memeriksa: '1F50D', rampung: '1F3C1',

  // —— 中级：职场与文件 ——
  agenda: '1F4C5', notulen: '1F4DD', peserta: '1F465', memimpin: '1F44B',
  presentasi: '1F4CA', dokumen: '1F4C4', laporan: '1F4CB', salinan: '1F4D1',
  lampiran: '1F4CE', formulir: '1F4DD', 'tanda tangan': '270D', stempel: '1F4EE',
  arsip: '1F5C4', map: '1F4C1', mencetak: '1F5A8', 'riwayat hidup': '1F4C4',
  wawancara: '1F4AC', kontrak: '1F4DC', pelatihan: '1F468', asuransi: '1F6E1',
  pensiun: '1F474', bonus: '1F381', 'slip gaji': '1F4B5', karyawan: '1F9D1',
  jabatan: '1F4BC', divisi: '1F3E2', promosi: '1F4C8', tunjangan: '1F4B0',
  'kotak alat': '1F9F0',

  // —— 中级：钱与买卖 ——
  'uang muka': '1F4B5', 'dompet digital': '1F4F1', cicilan: '1F4C5',
  'kartu kredit': '1F4B3', tagihan: '1F9FE', utang: '1F4B8', denda: '1F4B8',
  'cabang bank': '1F3E6', deposito: '1F4B0', 'tarik tunai': '1F3E7',
  'kartu ATM': '1F4B3', jaminan: '1F3E0', nasabah: '1F9D1', pinjaman: '1F4B0',
  iklan: '1F4E2', pelanggan: '1F6CD', penjualan: '1F4C8', brosur: '1F4C4',
  stok: '1F4E6', pameran: '1F3EA', merek: '1F3F7', pesaing: '1F3C3',
  keluhan: '1F620', garansi: '1F6E1', kasir: '1F9FE', 'label harga': '1F4B2',
  nota: '1F9FE', 'jam buka': '1F553', 'keranjang belanja': '1F6D2',
  promo: '1F4E2', voucher: '1F39F', pesanan: '1F4E6', 'toko online': '1F6D2',
  pemasukan: '1F4B5', pengeluaran: '1F4B8', hemat: '1F437', boros: '1F4B8',
  modal: '1F4B0', untung: '1F4C8', rugi: '1F4C9',

  // —— 中级：物流与仓储 ——
  gudang: '1F3ED', pengiriman: '1F69A', ekspedisi: '1F4E6', truk: '1F69B',
  timbangan: '2696', kemasan: '1F4E6', kontainer: '1F6A2', kardus: '1F4E6',
  palet: '1F4E6', forklift: '1F69C', lakban: '1F4CF', segel: '1F512',
  'kotak kayu': '1F4E6', ekspor: '1F6A2', impor: '1F6E9', kurs: '1F4B1',
  'mata uang': '1F4B1', pemasok: '1F3ED',

  // —— 中级：吃喝 ——
  kedai: '1F3EA', 'rumah makan': '1F37D', kantin: '1F35B', 'pesan antar': '1F6F5',
  'warung tenda': '26FA', renyah: '1F958', kenyal: '1F359', empuk: '1F356',
  matang: '1F373', mentah: '1F969', gosong: '1F525', harum: '1F338', amis: '1F41F',
  mengiris: '1F52A', memarut: '1F9C0', merendam: '1F4A7', mengukus: '2668',
  memanggang: '1F356', mengocok: '1F95A', menyaring: '2615', santan: '1F965',
  'tepung terigu': '1F35E', 'gula merah': '1F36F', 'minyak goreng': '1F35F',
  'saus tiram': '1F9C2', terasi: '1F990', ragi: '1F35E', mentega: '1F9C8',
  keju: '1F9C0', 'susu kental': '1F95B', 'asam jawa': '1F33F', kemiri: '1F330',
  kencur: '1FADA', serai: '1F33F', 'daun salam': '1F343', ketumbar: '1F33F',
  'kayu manis': '1FAB5', cengkeh: '1F33F', pala: '1F330', lengkuas: '1FADA',
  'martabak manis': '1F95E', kolak: '1F35B', 'es campur': '1F367', dodol: '1F36C',
  wajik: '1F359', 'lapis legit': '1F370', 'onde-onde': '1F361', serabi: '1F95E',
  'es teler': '1F367', lumpia: '1F959', 'otak-otak': '1F41F', karedok: '1F957',
  ketoprak: '1F35C', 'tahu gejrot': '1F35B', 'es cendol': '1F367',
  'es doger': '1F367', 'wedang jahe': '1F375', bandrek: '1F375',
  'jus jambu': '1F964', 'air tebu': '1F964', 'kopi tubruk': '2615',
  'teh tarik': '1F9CB', sirop: '1F964', jamu: '1F375', 'putu ayu': '1F35A',

  // —— 中级：穿戴与美容 ——
  kebaya: '1F457', batik: '1F454', sarung: '1F456', peci: '1F452',
  kemeja: '1F455', jilbab: '1F9D5', daster: '1F457', ukuran: '1F4CF',
  cincin: '1F48D', kalung: '1F4FF', gelang: '1F4FF', anting: '1F48E',
  bros: '1F338', 'ikat pinggang': '1F45C', berlian: '1F48E', mutiara: '1F4FF',
  bedak: '1F4A8', lipstik: '1F484', maskara: '1F441', parfum: '1F9F4',
  kuas: '1F58C', kutek: '1F485', 'masker wajah': '1F9F4', 'sabun muka': '1F9FC',
  jerawat: '1F634', kerutan: '1F475', 'tabir surya': '1F9F4',
  'potong rambut': '2702', poni: '1F487', keriting: '1F9B1', botak: '1F9B2',
  'cat rambut': '1F3A8', 'pangkas rambut': '1F488', kepang: '1F9B1',
  ketombe: '2744', rontok: '1F4C9',

  // —— 中级：住与修 ——
  'kolam renang': '1F3CA', 'kunci kartu': '1F511', losmen: '1F3E8',
  kontrakan: '1F3E0', kos: '1F6CF', perabot: '1F6CB', pindahan: '1F69A',
  bocor: '1F4A7', mampet: '1F6BD', korsleting: '26A1', tukang: '1F477',
  memperbaiki: '1F527', mengganti: '1F504', retak: '1F4A5', genteng: '1F3E0',
  obeng: '1FA9B', tang: '1F527', palu: '1F528', paku: '1F4CC', sekrup: '1F529',
  bor: '1FA9B', meteran: '1F4CF', gergaji: '1FA9A', 'kunci pas': '1F527',
  beton: '1F9F1', keramik: '1F9F1', triplek: '1FAB5', seng: '1F3E0',
  pipa: '1F6BF', kawat: '1F517', lem: '1F9F4', amplas: '1F4C4',

  // —— 中级：出行 ——
  helm: '26D1', jok: '1F4BA', knalpot: '1F4A8', rantai: '26D3',
  'jas hujan': '1F327', 'tambal ban': '1F6E0', angkot: '1F690',
  ongkos: '1F4B5', rute: '1F5FA', transit: '1F504', 'ojek online': '1F3CD',
  'boarding pass': '1F39F', paspor: '1F6C2', visa: '1F4D3',
  penerbangan: '2708', 'ruang tunggu': '1F4BA', 'bea cukai': '1F6C3',
  ban: '1F6DE', mesin: '2699', aki: '1F50B', bensin: '26FD', oli: '1F6E2',
  setir: '1F3CE', 'kaca spion': '1FA9E', bagasi: '1F9F3', bengkel: '1F527',
  ombak: '1F30A', pasir: '1F3D6', karang: '1FAB8', menyelam: '1F93F',
  berjemur: '1F31E', perahu: '1F6F6', pelampung: '1F6DF', pulau: '1F3DD',
  mendaki: '1F9D7', puncak: '26F0', tenda: '26FA', ransel: '1F392',
  'api unggun': '1F525', kabut: '1F32B', perjalanan: '1F9F3',
  wisatawan: '1F4F8', rombongan: '1F465', berfoto: '1F4F8',

  // —— 中级：健康 ——
  gejala: '1F912', diagnosis: '1FA7A', 'rawat inap': '1F3E5',
  'tes darah': '1FA78', rontgen: '1F9B4', operasi: '1F52A',
  antibiotik: '1F48A', dosis: '1F4CF', kapsul: '1F48A', apoteker: '1F9D1',
  'obat herbal': '1F33F', pingsan: '1F635', keseleo: '1F9B5',
  'patah tulang': '1F9B4', pendarahan: '1FA78', 'luka bakar': '1F525',
  tersedak: '1F636', keracunan: '2620', gigitan: '1F99F',
  'tekanan darah': '1FA7A', 'gula darah': '1F36C', 'berat badan': '2696',
  stres: '1F62B',

  // —— 中级：学与技术 ——
  latihan: '1F3CB', pelatih: '1F3C3', wasit: '1F3C1', skor: '1F4CA',
  cedera: '1F915', juara: '1F3C6', penonton: '1F465', nilai: '1F4AF',
  rapor: '1F4CB', semester: '1F4C5', beasiswa: '1F393', kampus: '1F3EB',
  dosen: '1F9D1', mahasiswa: '1F393', skripsi: '1F4DA', wisuda: '1F393',
  asrama: '1F3E2', kamus: '1F4D6', kosakata: '1F524', pelafalan: '1F5E3',
  logat: '1F5E3', menerjemahkan: '1F310', spidol: '1F58D', proyektor: '1F4FD',
  catatan: '1F4DD', kelompok: '1F465', materi: '1F4DA', laptop: '1F4BB',
  'papan ketik': '2328', tetikus: '1F5B1', kabel: '1F50C', 'hard disk': '1F4BE',
  memori: '1F4BE', pencetak: '1F5A8', 'pengisi daya': '1F50C',
  'perangkat lunak': '1F4BF', pembaruan: '1F504', pengaturan: '2699',
  tombol: '1F518', memasang: '2B07', menghapus: '1F5D1', gangguan: '26A0',
  jaringan: '1F4F6', router: '1F4E1', 'paket data': '1F4F6', server: '1F5A5',
  peramban: '1F310', memotret: '1F4F7', merekam: '1F3A5', lensa: '1F50E',
  tripod: '1F4F7', swafoto: '1F933', berita: '1F4F0', wartawan: '1F4F0',
  koran: '1F4F0', siaran: '1F4FB', judul: '1F4F0', 'media sosial': '1F4F1',
  sutradara: '1F3AC', pemeran: '1F3AD', adegan: '1F3AC', sinetron: '1F4FA',
  episode: '1F4FA', 'film dokumenter': '1F3A5', penyanyi: '1F3A4',
  band: '1F3B8', konser: '1F3A4', lirik: '1F3B5', irama: '1F3B6',
  dangdut: '1F3B6', gamelan: '1F941', panggung: '1F3AD', penggemar: '1F4E3',

  // —— 中级：社会与生活 ——
  KTP: '1FAAA', 'kartu keluarga': '1F46A', 'akta kelahiran': '1F4C3',
  SIM: '1F694', fotokopi: '1F4D1', 'surat keterangan': '1F4DC',
  kelurahan: '1F3DB', kecamatan: '1F3DB', loket: '1FA9F', petugas: '1F46E',
  cap: '1F4EE', peraturan: '1F4DC', larangan: '1F6AB', sanksi: '2696',
  pelanggaran: '1F6A8', 'petugas keamanan': '1F46E', warga: '1F465',
  'gotong royong': '1F91D', iuran: '1F4B5', ronda: '1F526',
  'kerja bakti': '1F9F9', 'sampah plastik': '1F5D1', 'daur ulang': '267B',
  'polusi udara': '1F32B', 'menanam pohon': '1F333', 'air bersih': '1F4A7',
  'sarung tangan': '1F9E4', 'alat pemadam': '1F9EF', rambu: '1F6A7',
  cctv: '1F4F9', 'kotak P3K': '26D1', pencuri: '1F9B9', copet: '1F45C',
  penipuan: '1F3AD', melapor: '1F4DE', bukti: '1F50E', pengacara: '2696',
  hakim: '2696', sidang: '1F3DB', saksi: '1F441', kasus: '1F4C1',
  perjanjian: '1F4DC', hak: '270A', kewajiban: '1F4CB', putusan: '2696',
  menyiram: '1F6BF', pupuk: '1F4A9', bibit: '1F331', pot: '1FAB4',
  layu: '1F342', berbuah: '1F34E', hama: '1F41B', memangkas: '2702',
  kandang: '1F3E0', vaksin: '1F489', 'dokter hewan': '1F9D1',
  memandikan: '1F6C1', jinak: '1F63A', galak: '1F63E', memelihara: '1F415',
  bedong: '1F476', 'susu formula': '1F37C', 'kereta bayi': '1F476',
  gendongan: '1F476', imunisasi: '1F489', rewel: '1F62D',
  'mainan bayi': '1F9F8', pacaran: '1F491', tunangan: '1F48D',
  'mas kawin': '1F48D', pengantin: '1F470', bercerai: '1F494',
  'undangan nikah': '1F48C', ketupat: '1F35A', angpau: '1F9E7',
  puasa: '1F31C', 'buka puasa': '1F37D', sahur: '1F319', ziarah: '1F5FF',
  'kue kering': '1F36A', ibadah: '1F64F', berdoa: '1F64F', khotbah: '1F4D6',
  jemaat: '1F465', penatua: '1F474', salat: '1F54C', azan: '1F54C',
  'kitab suci': '1F4D6', persembahan: '1F381', adat: '1F3EE',
  upacara: '1F3AA', 'berjabat tangan': '1F91D', 'buah tangan': '1F381',

  // —— 中级：抽象与度量 ——
  kilogram: '2696', gram: '2696', liter: '1F964', meter: '1F4CF',
  sentimeter: '1F4CF', lusin: '1F4E6', persen: '1F4CA', seperempat: '1F355',
  provinsi: '1F5FA', kabupaten: '1F5FA', 'ibu kota': '1F3D9', pesisir: '1F3D6',
  'dataran tinggi': '26F0', lembah: '1F3D4', danau: '1F3DE',
  'gunung berapi': '1F30B', perbatasan: '1F6A7', wilayah: '1F5FA',
  'jalan raya': '1F6E3', flyover: '1F309', 'pusat perbelanjaan': '1F3EC',
  'gedung bertingkat': '1F3E2', 'lampu jalan': '1F4A1', 'taman kota': '1F333',
  kemacetan: '1F68C', 'pasar tradisional': '1F3EA', sawah: '1F33E',
  panen: '1F33E', ladang: '1F33D', irigasi: '1F4A7', gubuk: '1F3DA',
  cakalang: '1F41F', tongkol: '1F41F', kakap: '1F41F', gurame: '1F41F',
  nila: '1F41F', 'rumput laut': '1F33F', 'ikan asin': '1F41F',
  'kepiting soka': '1F980', tambak: '1F3DE', duku: '1F34A',
  kelengkeng: '1F347', markisa: '1F349', srikaya: '1F34F',
  'jambu biji': '1F34F', langsat: '1F34A', 'buah naga': '1F349',
  'jambu air': '1F34E', rebung: '1F38B', petai: '1F33F', jengkol: '1F330',
  'labu siam': '1F383', 'daun singkong': '1F343', 'daun pepaya': '1F343',
  iga: '1F356', 'hati ayam': '1F357', usus: '1F35C', 'daging giling': '1F356',
  tulang: '1F9B4', lemak: '1F953', sosis: '1F32D', abon: '1F35A',
  'nasi kuning': '1F35B', bihun: '1F35C', kwetiau: '1F35C', ubi: '1F360',
  talas: '1F360', 'jagung rebus': '1F33D', blender: '1F373',
  'penanak nasi': '1F35A', microwave: '1F4E6', dispenser: '1F6B0',
  'penyedot debu': '1F9F9', 'kompor gas': '1F525', 'tabung gas': '1F6E2',
  'pengering rambut': '1F4A8', stopkontak: '1F50C', 'rak buku': '1F4DA',
  'lemari pakaian': '1F45A', 'karpet lantai': '1F9F6', tikar: '1F9FA',
  'rak sepatu': '1F45F', risiko: '26A0', tujuan: '1F3AF', manfaat: '2705',
  pilihan: '1F500', perubahan: '1F504', pengaruh: '1F4AB',
};

// 主题名（单词包 title）→ OpenMoji 码位。'默认' 必须存在，作为最终兜底。
export const THEME_EMOJI = {
  数字: '1F522', 饮料: '1F964', 颜色: '1F3A8', 主食: '1F35A',
  身体: '1F9CD', 肉蛋豆: '1F95A', 房间: '1F3E0', 水果: '1F34E',
  包装: '1F4E6', 蔬菜: '1F966', 家具: '1F6CB', 海鲜: '1F41F',
  电器: '1F50C', 衣服: '1F455', 味道: '1F60B', 厨房: '1F373',
  本地菜: '1F35B', 家人: '1F46A', 人称: '1F464', 问候: '1F44B',
  礼貌: '1F647', 判断: '2714', 动作: '1F3C3', 家务: '1F9F9',
  时间: '1F551', 星期: '1F4C5', 月份: '1F4C6', 交通: '1F68C',
  方位: '1F9ED', 位置: '1F4CD', 数量: '1F522', 购物: '1F6D2',
  钱币: '1F4B5', 学校: '1F3EB', 学习: '1F4DA', 办公: '1F4BC',
  职业: '1F9D1', 医院: '1F3E5', 健康: '1F4AA', 情绪: '1F60A',
  性格: '1F9D0', 天气: '26C5', 自然: '1F332', 动物: '1F43E',
  虫类: '1F41B', 形容: '1F4CF', 形状: '1F537', 材料: '1FAB5',
  卫浴: '1F6C1', 清洁: '1F9FC', 卧室: '1F6CF', 客厅: '1F6CB',
  门窗: '1F6AA', 手机: '1F4F1', 网络: '1F310', 社交: '1F4AC',
  出行: '1F6B6', 住宿: '1F3E8', 城市: '1F3D9', 地点: '1F4CD',
  餐厅: '1F37D', 烹饪: '1F373', 调料: '1F9C2', 甜点: '1F370',
  小吃: '1F35F', 早餐: '1F373', 症状: '1F912', 药品: '1F48A',
  银行: '1F3E6', 邮寄: '1F4E6', 问路: '1F5FA', 常问: '2753',
  介词: '1F517', 连接: '1F517', 副词: '1F4AD', 家事: '1F389',
  婴幼: '1F476', 爱好: '1F3B5', 运动: '26BD', 旅游: '1F9F3',
  安全: '26A0', 感官: '1F441', 节日: '1F386', 常用: '2B50',
  工具物品: '1F9F0',
  人际: '1F91D', 年龄: '1F382', 交流: '1F5E3', 语气: '1F5E8', 频率: '1F501',
  会议: '1F4CB', 文件: '1F4C1', 求职: '1F4C4', 人事: '1F465',
  商务: '1F91D', 销售: '1F4C8', 客户: '1F6CE', 店铺: '1F3EA', 电商: '1F6D2',
  物流: '1F69A', 支付: '1F4B3', 餐饮: '1F37D', 厨艺: '1F52A', 食材: '1F9C2',
  甜品: '1F370', 服装: '1F457', 配饰: '1F48D', 美妆: '1F484', 护肤: '1F9F4',
  美发: '1F488', 租房: '1F3E0', 维修: '1F527', 汽车: '1F697', 摩托: '1F3CD',
  公交: '1F68C', 机场: '2708', 旅行: '1F9F3', 海边: '1F3D6', 山野: '26FA',
  医疗: '1FA7A', 急救: '1F691', 学业: '1F4DD', 大学: '1F393', 语言: '1F5E3',
  课堂: '1F4CB', 电脑: '1F4BB', 软件: '2699', 拍摄: '1F4F7', 媒体: '1F4F0',
  影视: '1F3AC', 音乐: '1F3B5', 证件: '1FAAA', 行政: '1F3DB', 法规: '1F6A6',
  社区: '1F3D8', 环保: '267B', 风险: '26A0', 法律: '2696', 贸易: '1F6A2',
  仓储: '1F3ED', 打包: '1F4E6', 工具: '1F528', 植物: '1F331', 宠物: '1F415',
  婚恋: '1F491', 节庆: '1F389', 宗教: '1F64F', 礼仪: '1F647', 习惯: '1F503',
  逻辑: '1F517', 程度: '1F4CF', 描述: '1F50D', 单位: '2696', 地理: '1F5FA',
  乡村: '1F33E', 肉类: '1F356', 家居: '1F6CB', 财务: '1F4B0', 综合: '2B50',
  // 词根包的 20 个主题（自然、身体等已在上面出现过的沿用原图）
  看与听: '1F441', 说与问: '1F5E3', 来与去: '1F6B6', 拿与给: '1F4E6',
  买与卖: '1F6D2', 做与用: '1F528', 吃喝住: '1F37D', 学与写: '1F4DD',
  想与知: '1F4AD', 情与愿: '1F60A', 大与小: '1F4CF', 好与坏: '2B50',
  快与慢: '1F501', 人与家: '1F3E0', 身体: '1F4AA', 时间: '23F0',
  位置: '1F4CD', 开与关: '1F6AA', 求与助: '1F91D',
  默认: '1F4D6',
};
