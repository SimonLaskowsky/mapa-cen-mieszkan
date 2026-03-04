export interface RcnTransaction {
  city: string;
  lat: number;           // WGS84 after reprojection
  lng: number;
  priceTotal: number;    // PLN
  areaM2: number;
  pricePerM2: number;    // computed
  transactionDate: Date;
  marketType: 'primary' | 'secondary';
}

export interface RcnTransactionWithDistrict extends RcnTransaction {
  district: string;
}

export interface RcnAggregated {
  city: string;
  district: string;
  month: string;          // 'YYYY-MM-01'
  medianPriceM2: number;
  avgPriceM2: number;
  minPriceM2: number;
  maxPriceM2: number;
  p10PriceM2: number;
  p90PriceM2: number;
  transactionCount: number;
  countPrimary: number;
  countSecondary: number;
}
