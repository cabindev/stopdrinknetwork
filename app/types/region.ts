// ข้อมูลอ้างอิงตำบล/อำเภอ/จังหวัด/ภาค — ใช้กับ app/data/regions.ts และ lib/regionLookup.ts (ค้นหาตำบลฝั่ง server)
export interface RegionData {
  district: string; // ตำบล
  amphoe: string; // อำเภอ
  province: string; // จังหวัด
  zipcode: number | string;
  district_code: number | false;
  amphoe_code: number | false;
  province_code: number;
  zone: string; // โซนพื้นที่ เช่น "เหนือบน", "อีสานล่าง" — ชื่อฟิลด์ตรงกับ sdn-mapportal
}
