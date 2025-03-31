import { Injectable } from '@angular/core';
import { Region } from '../data.model';
import { AbstractPersistentDataService } from '../abstract-persistent-data.service';
import { mergeMap, of } from 'rxjs';



@Injectable({
  providedIn: 'root'
})
export class RegionService extends AbstractPersistentDataService<Region>{

  protected override getCollectionName(): string { return 'region'; }

  public init() {
    console.log('Initialize regions');
    regions.forEach(region => {
      this.byId(region.id).pipe(mergeMap(r => !r ? this.save(region) : of(r) )).subscribe()
    });
  }
}

const regions: Region[] = [
  {
    "id": "Europe",
    "lastChange": 0,
    "name": "Europe",
    "countries": [
      { "id": "ALB", "name": "Albania", "shortName": "ALB", "badgeSystem": 5 },
      { "id": "DEU", "name": "Germany", "shortName": "DEU", "badgeSystem": 5},
      { "id": "AND", "name": "Andorra", "shortName": "AND", "badgeSystem": 5 },
      { "id": "ARM", "name": "Armenia", "shortName": "ARM", "badgeSystem": 5 },
      { "id": "AUT", "name": "Austria", "shortName": "AUT", "badgeSystem": 5 },
      { "id": "AZE", "name": "Azerbaijan", "shortName": "AZE", "badgeSystem": 5 },
      { "id": "BEL", "name": "Belgium", "shortName": "BEL", "badgeSystem": 5 },
      { "id": "BLR", "name": "Belarus", "shortName": "BLR", "badgeSystem": 5 },
      { "id": "BIH", "name": "Bosnia and Herzegovina", "shortName": "BIH", "badgeSystem": 5 },
      { "id": "BGR", "name": "Bulgaria", "shortName": "BGR", "badgeSystem": 5 },
      { "id": "CYP", "name": "Cyprus", "shortName": "CYP", "badgeSystem": 5 },
      { "id": "HRV", "name": "Croatia", "shortName": "HRV", "badgeSystem": 5 },
      { "id": "DNK", "name": "Denmark", "shortName": "DNK", "badgeSystem": 5 },
      { "id": "ESP", "name": "Spain", "shortName": "ESP", "badgeSystem": 5 },
      { "id": "EST", "name": "Estonia", "shortName": "EST", "badgeSystem": 5 },
      { "id": "FIN", "name": "Finland", "shortName": "FIN", "badgeSystem": 5 },
      { "id": "FRA", "name": "France", "shortName": "FRA", "badgeSystem": 5 },
      { "id": "GEO", "name": "Georgia", "shortName": "GEO", "badgeSystem": 5 },
      { "id": "GRC", "name": "Greece", "shortName": "GRC", "badgeSystem": 5 },
      { "id": "HUN", "name": "Hungary", "shortName": "HUN", "badgeSystem": 5 },
      { "id": "IRL", "name": "Ireland", "shortName": "IRL", "badgeSystem": 5 },
      { "id": "ISL", "name": "Iceland", "shortName": "ISL", "badgeSystem": 5 },
      { "id": "ITA", "name": "Italy", "shortName": "ITA", "badgeSystem": 5 },
      { "id": "KAZ", "name": "Kazakhstan", "shortName": "KAZ", "badgeSystem": 5 },
      { "id": "XKX", "name": "Kosovo", "shortName": "XKX", "badgeSystem": 5 },
      { "id": "LVA", "name": "Latvia", "shortName": "LVA", "badgeSystem": 5 },
      { "id": "LIE", "name": "Liechtenstein", "shortName": "LIE", "badgeSystem": 5 },
      { "id": "LTU", "name": "Lithuania", "shortName": "LTU", "badgeSystem": 5 },
      { "id": "LUX", "name": "Luxembourg", "shortName": "LUX", "badgeSystem": 5 },
      { "id": "MKD", "name": "North Macedonia", "shortName": "MKD", "badgeSystem": 5 },
      { "id": "MLT", "name": "Malta", "shortName": "MLT", "badgeSystem": 5 },
      { "id": "MDA", "name": "Moldova", "shortName": "MDA", "badgeSystem": 5 },
      { "id": "MCO", "name": "Monaco", "shortName": "MCO", "badgeSystem": 5 },
      { "id": "MNE", "name": "Montenegro", "shortName": "MNE", "badgeSystem": 5 },
      { "id": "NOR", "name": "Norway", "shortName": "NOR", "badgeSystem": 5 },
      { "id": "NLD", "name": "Netherlands", "shortName": "NLD", "badgeSystem": 5 },
      { "id": "POL", "name": "Poland", "shortName": "POL", "badgeSystem": 5 },
      { "id": "PRT", "name": "Portugal", "shortName": "PRT", "badgeSystem": 5 },
      { "id": "CZE", "name": "Czechia", "shortName": "CZE", "badgeSystem": 5 },
      { "id": "ROU", "name": "Romania", "shortName": "ROU", "badgeSystem": 5 },
      { "id": "WLS", "name": "Wales", "shortName": "WLS", "badgeSystem": 5 },
      { "id": "SCT", "name": "Scotland", "shortName": "SCT", "badgeSystem": 5 },
      { "id": "ENG", "name": "England", "shortName": "ENG", "badgeSystem": 5 },
      { "id": "RUS", "name": "Russia", "shortName": "RUS", "badgeSystem": 5 },
      { "id": "SMR", "name": "San Marino", "shortName": "SMR", "badgeSystem": 5 },
      { "id": "SRB", "name": "Serbia", "shortName": "SRB", "badgeSystem": 5 },
      { "id": "SVK", "name": "Slovakia", "shortName": "SVK", "badgeSystem": 5 },
      { "id": "SVN", "name": "Slovenia", "shortName": "SVN", "badgeSystem": 5 },
      { "id": "SWE", "name": "Sweden", "shortName": "SWE", "badgeSystem": 5 },
      { "id": "CHE", "name": "Switzerland", "shortName": "CHE", "badgeSystem": 5 },
      { "id": "TUR", "name": "Turkey", "shortName": "TUR", "badgeSystem": 5 },
      { "id": "UKR", "name": "Ukraine", "shortName": "UKR", "badgeSystem": 5 },
      { "id": "VAT", "name": "Vatican City", "shortName": "VAT", "badgeSystem": 5 },
    ]
  },
  {
    "id": "America",
    "lastChange": 0,
    "name": "America",
    "countries": [
      { "id": "ARG", "name": "Argentina", "shortName": "ARG" },
      { "id": "BOL", "name": "Bolivia", "shortName": "BOL" },
      { "id": "BRA", "name": "Brazil", "shortName": "BRA" },
      { "id": "CHL", "name": "Chile", "shortName": "CHL" },
      { "id": "COL", "name": "Colombia", "shortName": "COL" },
      { "id": "CRI", "name": "Costa Rica", "shortName": "CRI" },
      { "id": "CUB", "name": "Cuba", "shortName": "CUB" },
      { "id": "DOM", "name": "Dominican Republic", "shortName": "DOM" },
      { "id": "ECU", "name": "Ecuador", "shortName": "ECU" },
      { "id": "SLV", "name": "El Salvador", "shortName": "SLV" },
      { "id": "GTM", "name": "Guatemala", "shortName": "GTM" },
      { "id": "HND", "name": "Honduras", "shortName": "HND" },
      { "id": "MEX", "name": "Mexico", "shortName": "MEX" },
      { "id": "NIC", "name": "Nicaragua", "shortName": "NIC" },
      { "id": "PAN", "name": "Panama", "shortName": "PAN" },
      { "id": "PRY", "name": "Paraguay", "shortName": "PRY" },
      { "id": "PER", "name": "Peru", "shortName": "PER" },
      { "id": "URY", "name": "Uruguay", "shortName": "URY" },
      { "id": "VEN", "name": "Venezuela", "shortName": "VEN" },
      { "id": "CAN", "name": "Canada", "shortName": "CAN" },
      { "id": "USA", "name": "United States", "shortName": "USA", "badgeSystem": 5 },
      { "id": "BLZ", "name": "Belize", "shortName": "BLZ" },
      { "id": "JAM", "name": "Jamaica", "shortName": "JAM" },
      { "id": "HTI", "name": "Haiti", "shortName": "HTI" },
      { "id": "BRB", "name": "Barbados", "shortName": "BRB" },
      { "id": "TTO", "name": "Trinidad and Tobago", "shortName": "TTO" },
      { "id": "BHS", "name": "Bahamas", "shortName": "BHS" },
      { "id": "GRD", "name": "Grenada", "shortName": "GRD" },
      { "id": "LCA", "name": "Saint Lucia", "shortName": "LCA" },
      { "id": "VCT", "name": "Saint Vincent and the Grenadines", "shortName": "VCT" },
      { "id": "ATG", "name": "Antigua and Barbuda", "shortName": "ATG" },
      { "id": "DMA", "name": "Dominica", "shortName": "DMA" },
      { "id": "KNA", "name": "Saint Kitts and Nevis", "shortName": "KNA" }
    ]
  },
  {
    "id": "Africa",
    "lastChange": 0,
    "name": "Africa",
    "countries": [
      { "id": "DZA", "name": "Algeria", "shortName": "DZA" },
      { "id": "AGO", "name": "Angola", "shortName": "AGO" },
      { "id": "BEN", "name": "Benin", "shortName": "BEN" },
      { "id": "BWA", "name": "Botswana", "shortName": "BWA" },
      { "id": "BFA", "name": "Burkina Faso", "shortName": "BFA" },
      { "id": "BDI", "name": "Burundi", "shortName": "BDI" },
      { "id": "CPV", "name": "Cape Verde", "shortName": "CPV" },
      { "id": "CMR", "name": "Cameroon", "shortName": "CMR" },
      { "id": "CAF", "name": "Central African Republic", "shortName": "CAF" },
      { "id": "TCD", "name": "Chad", "shortName": "TCD" },
      { "id": "COM", "name": "Comoros", "shortName": "COM" },
      { "id": "COG", "name": "Republic of the Congo", "shortName": "COG" },
      { "id": "COD", "name": "Democratic Republic of the Congo", "shortName": "COD" },
      { "id": "DJI", "name": "Djibouti", "shortName": "DJI" },
      { "id": "EGY", "name": "Egypt", "shortName": "EGY" },
      { "id": "GNQ", "name": "Equatorial Guinea", "shortName": "GNQ" },
      { "id": "ERI", "name": "Eritrea", "shortName": "ERI" },
      { "id": "SWZ", "name": "Eswatini", "shortName": "SWZ" },
      { "id": "ETH", "name": "Ethiopia", "shortName": "ETH" },
      { "id": "GAB", "name": "Gabon", "shortName": "GAB" },
      { "id": "GMB", "name": "Gambia", "shortName": "GMB" },
      { "id": "GHA", "name": "Ghana", "shortName": "GHA" },
      { "id": "GIN", "name": "Guinea", "shortName": "GIN" },
      { "id": "GNB", "name": "Guinea-Bissau", "shortName": "GNB" },
      { "id": "CIV", "name": "Ivory Coast", "shortName": "CIV" },
      { "id": "KEN", "name": "Kenya", "shortName": "KEN" },
      { "id": "LSO", "name": "Lesotho", "shortName": "LSO" },
      { "id": "LBR", "name": "Liberia", "shortName": "LBR" },
      { "id": "LBY", "name": "Libya", "shortName": "LBY" },
      { "id": "MDG", "name": "Madagascar", "shortName": "MDG" },
      { "id": "MWI", "name": "Malawi", "shortName": "MWI" },
      { "id": "MLI", "name": "Mali", "shortName": "MLI" },
      { "id": "MRT", "name": "Mauritania", "shortName": "MRT" },
      { "id": "MUS", "name": "Mauritius", "shortName": "MUS" },
      { "id": "MAR", "name": "Morocco", "shortName": "MAR" },
      { "id": "MOZ", "name": "Mozambique", "shortName": "MOZ" },
      { "id": "NAM", "name": "Namibia", "shortName": "NAM" },
      { "id": "NER", "name": "Niger", "shortName": "NER" },
      { "id": "NGA", "name": "Nigeria", "shortName": "NGA" },
      { "id": "RWA", "name": "Rwanda", "shortName": "RWA" },
      { "id": "STP", "name": "São Tomé and Príncipe", "shortName": "STP" },
      { "id": "SEN", "name": "Senegal", "shortName": "SEN" },
      { "id": "SYC", "name": "Seychelles", "shortName": "SYC" },
      { "id": "SLE", "name": "Sierra Leone", "shortName": "SLE" },
      { "id": "SOM", "name": "Somalia", "shortName": "SOM" },
      { "id": "ZAF", "name": "South Africa", "shortName": "ZAF", "badgeSystem": 5 },
      { "id": "SSD", "name": "South Sudan", "shortName": "SSD" },
      { "id": "SDN", "name": "Sudan", "shortName": "SDN" },
      { "id": "TZA", "name": "Tanzania", "shortName": "TZA" },
      { "id": "TGO", "name": "Togo", "shortName": "TGO" },
      { "id": "TUN", "name": "Tunisia", "shortName": "TUN" },
      { "id": "UGA", "name": "Uganda", "shortName": "UGA" },
      { "id": "ZMB", "name": "Zambia", "shortName": "ZMB" },
      { "id": "ZWE", "name": "Zimbabwe", "shortName": "ZWE" }
    ]
  },
  {
    "id": "Asia",
    "lastChange": 0,
    "name": "Asia",
    "countries":[
      { "id": "AFG", "name": "Afghanistan", "shortName": "AFG" },
      { "id": "ARM", "name": "Armenia", "shortName": "ARM" },
      { "id": "AZE", "name": "Azerbaijan", "shortName": "AZE" },
      { "id": "BHR", "name": "Bahrain", "shortName": "BHR" },
      { "id": "BGD", "name": "Bangladesh", "shortName": "BGD" },
      { "id": "BTN", "name": "Bhutan", "shortName": "BTN" },
      { "id": "BRN", "name": "Brunei", "shortName": "BRN" },
      { "id": "KHM", "name": "Cambodia", "shortName": "KHM" },
      { "id": "CHN", "name": "China", "shortName": "CHN" },
      { "id": "CYP", "name": "Cyprus", "shortName": "CYP" },
      { "id": "GEO", "name": "Georgia", "shortName": "GEO" },
      { "id": "IND", "name": "India", "shortName": "IND" },
      { "id": "IDN", "name": "Indonesia", "shortName": "IDN" },
      { "id": "IRN", "name": "Iran", "shortName": "IRN" },
      { "id": "IRQ", "name": "Iraq", "shortName": "IRQ" },
      { "id": "ISR", "name": "Israel", "shortName": "ISR" },
      { "id": "JPN", "name": "Japan", "shortName": "JPN" },
      { "id": "JOR", "name": "Jordan", "shortName": "JOR" },
      { "id": "KAZ", "name": "Kazakhstan", "shortName": "KAZ" },
      { "id": "KWT", "name": "Kuwait", "shortName": "KWT" },
      { "id": "KGZ", "name": "Kyrgyzstan", "shortName": "KGZ" },
      { "id": "LAO", "name": "Laos", "shortName": "LAO" },
      { "id": "LBN", "name": "Lebanon", "shortName": "LBN" },
      { "id": "MYS", "name": "Malaysia", "shortName": "MYS" },
      { "id": "MDV", "name": "Maldives", "shortName": "MDV" },
      { "id": "MNG", "name": "Mongolia", "shortName": "MNG" },
      { "id": "MMR", "name": "Myanmar", "shortName": "MMR" },
      { "id": "NPL", "name": "Nepal", "shortName": "NPL" },
      { "id": "PRK", "name": "North Korea", "shortName": "PRK" },
      { "id": "OMN", "name": "Oman", "shortName": "OMN" },
      { "id": "PAK", "name": "Pakistan", "shortName": "PAK" },
      { "id": "PSE", "name": "Palestine", "shortName": "PSE" },
      { "id": "PHL", "name": "Philippines", "shortName": "PHL" },
      { "id": "QAT", "name": "Qatar", "shortName": "QAT" },
      { "id": "SAU", "name": "Saudi Arabia", "shortName": "SAU" },
      { "id": "SGP", "name": "Singapore", "shortName": "SGP" },
      { "id": "KOR", "name": "South Korea", "shortName": "KOR" },
      { "id": "LKA", "name": "Sri Lanka", "shortName": "LKA" },
      { "id": "SYR", "name": "Syria", "shortName": "SYR" },
      { "id": "TWN", "name": "Taiwan", "shortName": "TWN" },
      { "id": "TJK", "name": "Tajikistan", "shortName": "TJK" },
      { "id": "THA", "name": "Thailand", "shortName": "THA" },
      { "id": "TLS", "name": "Timor-Leste", "shortName": "TLS" },
      { "id": "TUR", "name": "Turkey", "shortName": "TUR" },
      { "id": "TKM", "name": "Turkmenistan", "shortName": "TKM" },
      { "id": "ARE", "name": "United Arab Emirates", "shortName": "ARE" },
      { "id": "UZB", "name": "Uzbekistan", "shortName": "UZB" },
      { "id": "VNM", "name": "Vietnam", "shortName": "VNM" },
      { "id": "YEM", "name": "Yemen", "shortName": "YEM" }
    ]
  },
  {
    "id": "Oceania",
    "lastChange": 0,
    "name": "Oceania",
    "countries":[
      { "id": "AUS", "name": "Australia", "shortName": "AUS", "badgeSystem": 6 },
      { "id": "NZL", "name": "New Zealand", "shortName": "NZL" },
      { "id": "FJI", "name": "Fiji", "shortName": "FJI" },
      { "id": "KIR", "name": "Kiribati", "shortName": "KIR" },
      { "id": "MHL", "name": "Marshall Islands", "shortName": "MHL" },
      { "id": "FSM", "name": "Micronesia", "shortName": "FSM" },
      { "id": "NRU", "name": "Nauru", "shortName": "NRU" },
      { "id": "PLW", "name": "Palau", "shortName": "PLW" },
      { "id": "PNG", "name": "Papua New Guinea", "shortName": "PNG" },
      { "id": "WSM", "name": "Samoa", "shortName": "WSM" },
      { "id": "SLB", "name": "Solomon Islands", "shortName": "SLB" },
      { "id": "TON", "name": "Tonga", "shortName": "TON" },
      { "id": "TUV", "name": "Tuvalu", "shortName": "TUV" },
      { "id": "VUT", "name": "Vanuatu", "shortName": "VUT" }
    ]
  }
]
;

