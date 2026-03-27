# World Bank Databank（WDI）データ取得ガイド（Node.js）

## ■ 概要

World Bank Databank の WDI（World Development Indicators）は、
Node.js から API を使って直接取得可能。

* 認証不要
* JSON取得可能
* 複数国・複数指標・期間指定対応

---

## ■ API 基本構造

```bash
https://api.worldbank.org/v2/country/{国コード}/indicator/{指標コード}?source=2&format=json
```

### 主なパラメータ

| パラメータ          | 内容     |
| -------------- | ------ |
| source=2       | WDI指定  |
| format=json    | JSON形式 |
| date=2000:2025 | 年範囲    |
| per_page=1000  | 件数     |
| page=1         | ページ    |

---

## ■ 対象指標リスト

```js
const indicators = [
  'NY.GDP.PETR.RT.ZS',
  'EG.IMP.CONS.ZS',
  'FP.CPI.TOTL.ZG',
  'NE.TRD.GNFS.ZS',
  'NE.IMP.GNFS.ZS',
  'NE.EXP.GNFS.ZS',
  'NY.GDP.MKTP.KD.ZG',
  'BN.CAB.XOKA.GD.ZS',
  'DT.DOD.DECT.CD',
  'GC.XPN.INTP.RV.ZS',
  'NE.GDI.TOTL.ZS',
  'BX.KLT.DINV.WD.GD.ZS',
  'PV.EST'
];
```

---

## ■ Node.js サンプルコード（複数指標取得）

```js
const BASE_URL = 'https://api.worldbank.org/v2';
const SOURCE_ID = 2;

const countries = ['JPN', 'USA', 'CHN', 'IND', 'SAU', 'ARE'];

async function fetchWorldBankPage({ countries, indicators, startYear, endYear, page = 1, perPage = 1000 }) {
  const countryPart = countries.join(';');
  const indicatorPart = indicators.join(';');

  const url =
    `${BASE_URL}/country/${countryPart}/indicator/${indicatorPart}` +
    `?source=${SOURCE_ID}` +
    `&format=json` +
    `&date=${startYear}:${endYear}` +
    `&page=${page}` +
    `&per_page=${perPage}`;

  const res = await fetch(url);
  const json = await res.json();

  return {
    meta: json[0],
    rows: json[1] ?? []
  };
}

async function fetchAll({ countries, indicators, startYear, endYear }) {
  let page = 1;
  const allRows = [];

  while (true) {
    const { meta, rows } = await fetchWorldBankPage({
      countries,
      indicators,
      startYear,
      endYear,
      page
    });

    allRows.push(...rows);

    if (page >= meta.pages) break;
    page++;
  }

  return allRows;
}
```

---

## ■ データ整形

```js
function normalize(rows) {
  return rows.map(r => ({
    country: r.country?.value,
    iso3: r.countryiso3code,
    indicator: r.indicator?.id,
    year: Number(r.date),
    value: r.value
  }));
}
```

---

## ■ CSV出力

```js
import { writeFile } from 'node:fs/promises';

function toCsv(rows) {
  const header = ['country','iso3','indicator','year','value'];
  const lines = [header.join(',')];

  for (const r of rows) {
    lines.push([r.country, r.iso3, r.indicator, r.year, r.value ?? ''].join(','));
  }

  return lines.join('\n');
}
```

---

## ■ URL例

### 単一指標

```bash
https://api.worldbank.org/v2/country/JPN/indicator/FP.CPI.TOTL.ZG?source=2&format=json
```

### 複数国

```bash
https://api.worldbank.org/v2/country/JPN;USA;CHN/indicator/FP.CPI.TOTL.ZG?source=2&format=json
```

### 複数指標

```bash
https://api.worldbank.org/v2/country/JPN;USA/indicator/FP.CPI.TOTL.ZG;NY.GDP.MKTP.KD.ZG?source=2&format=json
```

---

## ■ 実務Tips

* 複数指標まとめ取得より「1指標ずつ」が安全
* per_page=1000 でページング必須
* 欠損値（null）多いのでフィルタ必要

---

## ■ 注意点

* 年次データ中心 → リアルタイム分析には弱い
* 戦争分析は他データと併用推奨

---

## ■ 次ステップ

* D3 / deck.gl で可視化
* GEEと組み合わせて空間分析
