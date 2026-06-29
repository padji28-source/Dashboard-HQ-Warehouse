export interface Product {
  kode: string;
  nama: string;
  satuan: string;
  kategori: string;
}

export interface Locator {
  whGroup: string;
  nama: string;
  deskripsi: string;
  whType: string;
  area: string;
}

export interface Transaction {
  tanggal: string; // Mm/Dd/Yy
  kodeProduk: string;
  namaBahan: string;
  kuantitas: number;
  uom: string;
  tipe: 'IN' | 'OUT' | 'AWAL';
  locator: string;
  locatorTo: string;
  noDocument: string;
  keterangan: string;
}

export interface StockSummary {
  kodeProduk: string;
  namaProduk: string;
  whGroup: string;
  namaLocator: string;
  whType: string;
  area: string;
  totalIn: number;
  totalOut: number;
  stock: number;
  qtySistem?: number;
  selisih?: number;
}
