// US commercial airports — IATA code + city + state. Bundled with the
// app so the AirportField search-as-you-type is instant and free
// (no API call needed). Sourced from FAA/IATA public data; trimmed
// to commercial-service airports likely to matter for golf trips.
//
// If you ever need to add an obscure regional field, just append a
// row — alphabetical order isn't required.

export type Airport = {
  code: string;   // 3-letter IATA
  name: string;   // colloquial — e.g. "Hartsfield-Jackson"
  city: string;
  state: string;
};

export const US_AIRPORTS: Airport[] = [
  // ── Major hubs ────────────────────────────────────────────────────
  { code: "ATL", name: "Hartsfield-Jackson", city: "Atlanta", state: "GA" },
  { code: "AUS", name: "Austin-Bergstrom", city: "Austin", state: "TX" },
  { code: "BNA", name: "Nashville International", city: "Nashville", state: "TN" },
  { code: "BOS", name: "Boston Logan", city: "Boston", state: "MA" },
  { code: "BWI", name: "Baltimore/Washington Thurgood Marshall", city: "Baltimore", state: "MD" },
  { code: "CLT", name: "Charlotte Douglas", city: "Charlotte", state: "NC" },
  { code: "DCA", name: "Reagan National", city: "Washington", state: "DC" },
  { code: "DEN", name: "Denver International", city: "Denver", state: "CO" },
  { code: "DFW", name: "Dallas/Fort Worth", city: "Dallas", state: "TX" },
  { code: "DTW", name: "Detroit Metropolitan", city: "Detroit", state: "MI" },
  { code: "EWR", name: "Newark Liberty", city: "Newark", state: "NJ" },
  { code: "FLL", name: "Fort Lauderdale-Hollywood", city: "Fort Lauderdale", state: "FL" },
  { code: "HNL", name: "Daniel K. Inouye (Honolulu)", city: "Honolulu", state: "HI" },
  { code: "HOU", name: "William P. Hobby", city: "Houston", state: "TX" },
  { code: "IAD", name: "Washington Dulles", city: "Washington", state: "DC" },
  { code: "IAH", name: "George Bush Intercontinental", city: "Houston", state: "TX" },
  { code: "JFK", name: "John F. Kennedy", city: "New York", state: "NY" },
  { code: "LAS", name: "Harry Reid (Las Vegas)", city: "Las Vegas", state: "NV" },
  { code: "LAX", name: "Los Angeles International", city: "Los Angeles", state: "CA" },
  { code: "LGA", name: "LaGuardia", city: "New York", state: "NY" },
  { code: "MCO", name: "Orlando International", city: "Orlando", state: "FL" },
  { code: "MDW", name: "Chicago Midway", city: "Chicago", state: "IL" },
  { code: "MIA", name: "Miami International", city: "Miami", state: "FL" },
  { code: "MSP", name: "Minneapolis-Saint Paul", city: "Minneapolis", state: "MN" },
  { code: "MSY", name: "Louis Armstrong New Orleans", city: "New Orleans", state: "LA" },
  { code: "OAK", name: "Oakland International", city: "Oakland", state: "CA" },
  { code: "ORD", name: "O'Hare International", city: "Chicago", state: "IL" },
  { code: "PDX", name: "Portland International", city: "Portland", state: "OR" },
  { code: "PHL", name: "Philadelphia International", city: "Philadelphia", state: "PA" },
  { code: "PHX", name: "Sky Harbor", city: "Phoenix", state: "AZ" },
  { code: "PIT", name: "Pittsburgh International", city: "Pittsburgh", state: "PA" },
  { code: "RDU", name: "Raleigh-Durham", city: "Raleigh", state: "NC" },
  { code: "SAN", name: "San Diego International", city: "San Diego", state: "CA" },
  { code: "SEA", name: "Seattle-Tacoma", city: "Seattle", state: "WA" },
  { code: "SFO", name: "San Francisco International", city: "San Francisco", state: "CA" },
  { code: "SLC", name: "Salt Lake City International", city: "Salt Lake City", state: "UT" },
  { code: "STL", name: "St. Louis Lambert", city: "St. Louis", state: "MO" },
  { code: "TPA", name: "Tampa International", city: "Tampa", state: "FL" },

  // ── Golf-trip regionals (covers every catalog itinerary) ──────────
  { code: "ABQ", name: "Albuquerque International Sunport", city: "Albuquerque", state: "NM" },
  { code: "ABE", name: "Lehigh Valley International", city: "Allentown", state: "PA" },
  { code: "ALB", name: "Albany International", city: "Albany", state: "NY" },
  { code: "AMA", name: "Rick Husband Amarillo", city: "Amarillo", state: "TX" },
  { code: "ANC", name: "Ted Stevens Anchorage", city: "Anchorage", state: "AK" },
  { code: "ASE", name: "Aspen/Pitkin County", city: "Aspen", state: "CO" },
  { code: "AVL", name: "Asheville Regional", city: "Asheville", state: "NC" },
  { code: "AZA", name: "Phoenix-Mesa Gateway", city: "Mesa", state: "AZ" },
  { code: "BDL", name: "Bradley International", city: "Hartford", state: "CT" },
  { code: "BFL", name: "Meadows Field (Bakersfield)", city: "Bakersfield", state: "CA" },
  { code: "BGR", name: "Bangor International", city: "Bangor", state: "ME" },
  { code: "BHM", name: "Birmingham-Shuttlesworth", city: "Birmingham", state: "AL" },
  { code: "BIL", name: "Billings Logan", city: "Billings", state: "MT" },
  { code: "BOI", name: "Boise Airport", city: "Boise", state: "ID" },
  { code: "BTV", name: "Burlington International", city: "Burlington", state: "VT" },
  { code: "BUF", name: "Buffalo Niagara", city: "Buffalo", state: "NY" },
  { code: "BUR", name: "Bob Hope (Burbank)", city: "Burbank", state: "CA" },
  { code: "BZN", name: "Bozeman Yellowstone", city: "Bozeman", state: "MT" },
  { code: "CAE", name: "Columbia Metropolitan", city: "Columbia", state: "SC" },
  { code: "CAK", name: "Akron-Canton", city: "Akron", state: "OH" },
  { code: "CHA", name: "Chattanooga Metropolitan", city: "Chattanooga", state: "TN" },
  { code: "CHO", name: "Charlottesville-Albemarle", city: "Charlottesville", state: "VA" },
  { code: "CHS", name: "Charleston International", city: "Charleston", state: "SC" },
  { code: "CID", name: "Cedar Rapids", city: "Cedar Rapids", state: "IA" },
  { code: "CLE", name: "Cleveland Hopkins", city: "Cleveland", state: "OH" },
  { code: "CMH", name: "John Glenn Columbus", city: "Columbus", state: "OH" },
  { code: "COS", name: "Colorado Springs", city: "Colorado Springs", state: "CO" },
  { code: "CRP", name: "Corpus Christi International", city: "Corpus Christi", state: "TX" },
  { code: "CRW", name: "Yeager (Charleston, WV)", city: "Charleston", state: "WV" },
  { code: "CVG", name: "Cincinnati/Northern Kentucky", city: "Cincinnati", state: "OH" },
  { code: "DAL", name: "Dallas Love Field", city: "Dallas", state: "TX" },
  { code: "DAY", name: "Dayton International", city: "Dayton", state: "OH" },
  { code: "DSM", name: "Des Moines International", city: "Des Moines", state: "IA" },
  { code: "ECP", name: "Northwest Florida Beaches", city: "Panama City", state: "FL" },
  { code: "EGE", name: "Eagle County (Vail)", city: "Vail", state: "CO" },
  { code: "ELP", name: "El Paso International", city: "El Paso", state: "TX" },
  { code: "EUG", name: "Eugene Mahlon Sweet", city: "Eugene", state: "OR" },
  { code: "EVV", name: "Evansville Regional", city: "Evansville", state: "IN" },
  { code: "FAR", name: "Hector International (Fargo)", city: "Fargo", state: "ND" },
  { code: "FAT", name: "Fresno Yosemite", city: "Fresno", state: "CA" },
  { code: "FAY", name: "Fayetteville Regional", city: "Fayetteville", state: "NC" },
  { code: "FCA", name: "Glacier Park International", city: "Kalispell", state: "MT" },
  { code: "FNT", name: "Bishop International (Flint)", city: "Flint", state: "MI" },
  { code: "FSD", name: "Sioux Falls Regional", city: "Sioux Falls", state: "SD" },
  { code: "FWA", name: "Fort Wayne International", city: "Fort Wayne", state: "IN" },
  { code: "GEG", name: "Spokane International", city: "Spokane", state: "WA" },
  { code: "GJT", name: "Grand Junction Regional", city: "Grand Junction", state: "CO" },
  { code: "GPT", name: "Gulfport-Biloxi International", city: "Gulfport", state: "MS" },
  { code: "GRB", name: "Green Bay Austin Straubel", city: "Green Bay", state: "WI" },
  { code: "GRR", name: "Gerald R. Ford (Grand Rapids)", city: "Grand Rapids", state: "MI" },
  { code: "GSO", name: "Piedmont Triad", city: "Greensboro", state: "NC" },
  { code: "GSP", name: "Greenville-Spartanburg", city: "Greenville", state: "SC" },
  { code: "HHH", name: "Hilton Head Island", city: "Hilton Head", state: "SC" },
  { code: "HSV", name: "Huntsville International", city: "Huntsville", state: "AL" },
  { code: "ICT", name: "Wichita Eisenhower", city: "Wichita", state: "KS" },
  { code: "IDA", name: "Idaho Falls Regional", city: "Idaho Falls", state: "ID" },
  { code: "ILM", name: "Wilmington International", city: "Wilmington", state: "NC" },
  { code: "IND", name: "Indianapolis International", city: "Indianapolis", state: "IN" },
  { code: "ISP", name: "Long Island MacArthur", city: "Islip", state: "NY" },
  { code: "ITO", name: "Hilo International", city: "Hilo", state: "HI" },
  { code: "JAC", name: "Jackson Hole", city: "Jackson", state: "WY" },
  { code: "JAN", name: "Jackson-Medgar Evers", city: "Jackson", state: "MS" },
  { code: "JAX", name: "Jacksonville International", city: "Jacksonville", state: "FL" },
  { code: "KOA", name: "Kona International", city: "Kailua-Kona", state: "HI" },
  { code: "LBB", name: "Lubbock Preston Smith", city: "Lubbock", state: "TX" },
  { code: "LEX", name: "Blue Grass Airport (Lexington)", city: "Lexington", state: "KY" },
  { code: "LFT", name: "Lafayette Regional", city: "Lafayette", state: "LA" },
  { code: "LGB", name: "Long Beach", city: "Long Beach", state: "CA" },
  { code: "LIH", name: "Lihue (Kauai)", city: "Lihue", state: "HI" },
  { code: "LIT", name: "Bill and Hillary Clinton (Little Rock)", city: "Little Rock", state: "AR" },
  { code: "LWB", name: "Greenbrier Valley", city: "Lewisburg", state: "WV" },
  { code: "MAF", name: "Midland International", city: "Midland", state: "TX" },
  { code: "MBS", name: "MBS International (Saginaw)", city: "Saginaw", state: "MI" },
  { code: "MCI", name: "Kansas City International", city: "Kansas City", state: "MO" },
  { code: "MFR", name: "Rogue Valley International (Medford)", city: "Medford", state: "OR" },
  { code: "MGM", name: "Montgomery Regional", city: "Montgomery", state: "AL" },
  { code: "MHT", name: "Manchester-Boston Regional", city: "Manchester", state: "NH" },
  { code: "MKE", name: "Milwaukee Mitchell", city: "Milwaukee", state: "WI" },
  { code: "MLI", name: "Quad City International", city: "Moline", state: "IL" },
  { code: "MOB", name: "Mobile Regional", city: "Mobile", state: "AL" },
  { code: "MRY", name: "Monterey Regional", city: "Monterey", state: "CA" },
  { code: "MSN", name: "Dane County Regional (Madison)", city: "Madison", state: "WI" },
  { code: "MYR", name: "Myrtle Beach International", city: "Myrtle Beach", state: "SC" },
  { code: "OGG", name: "Kahului (Maui)", city: "Kahului", state: "HI" },
  { code: "OKC", name: "Will Rogers World (OKC)", city: "Oklahoma City", state: "OK" },
  { code: "OMA", name: "Eppley Airfield (Omaha)", city: "Omaha", state: "NE" },
  { code: "ONT", name: "Ontario International", city: "Ontario", state: "CA" },
  { code: "ORF", name: "Norfolk International", city: "Norfolk", state: "VA" },
  { code: "PBI", name: "Palm Beach International", city: "West Palm Beach", state: "FL" },
  { code: "PHF", name: "Newport News/Williamsburg", city: "Newport News", state: "VA" },
  { code: "PNS", name: "Pensacola International", city: "Pensacola", state: "FL" },
  { code: "PSP", name: "Palm Springs International", city: "Palm Springs", state: "CA" },
  { code: "PVD", name: "Rhode Island T.F. Green", city: "Providence", state: "RI" },
  { code: "PWM", name: "Portland International Jetport", city: "Portland", state: "ME" },
  { code: "RAP", name: "Rapid City Regional", city: "Rapid City", state: "SD" },
  { code: "RDM", name: "Redmond Municipal (Bend)", city: "Redmond", state: "OR" },
  { code: "RIC", name: "Richmond International", city: "Richmond", state: "VA" },
  { code: "RNO", name: "Reno-Tahoe International", city: "Reno", state: "NV" },
  { code: "ROA", name: "Roanoke-Blacksburg", city: "Roanoke", state: "VA" },
  { code: "ROC", name: "Greater Rochester International", city: "Rochester", state: "NY" },
  { code: "RSW", name: "Southwest Florida (Fort Myers)", city: "Fort Myers", state: "FL" },
  { code: "SAF", name: "Santa Fe Regional", city: "Santa Fe", state: "NM" },
  { code: "SAT", name: "San Antonio International", city: "San Antonio", state: "TX" },
  { code: "SAV", name: "Savannah/Hilton Head", city: "Savannah", state: "GA" },
  { code: "SBA", name: "Santa Barbara Municipal", city: "Santa Barbara", state: "CA" },
  { code: "SBN", name: "South Bend International", city: "South Bend", state: "IN" },
  { code: "SBP", name: "San Luis Obispo Regional", city: "San Luis Obispo", state: "CA" },
  { code: "SDF", name: "Louisville Muhammad Ali", city: "Louisville", state: "KY" },
  { code: "SFB", name: "Orlando Sanford", city: "Sanford", state: "FL" },
  { code: "SGF", name: "Springfield-Branson", city: "Springfield", state: "MO" },
  { code: "SGU", name: "St. George Regional", city: "St. George", state: "UT" },
  { code: "SHV", name: "Shreveport Regional", city: "Shreveport", state: "LA" },
  { code: "SJC", name: "San Jose International", city: "San Jose", state: "CA" },
  { code: "SMF", name: "Sacramento International", city: "Sacramento", state: "CA" },
  { code: "SNA", name: "John Wayne (Orange County)", city: "Santa Ana", state: "CA" },
  { code: "SRQ", name: "Sarasota-Bradenton", city: "Sarasota", state: "FL" },
  { code: "STT", name: "Cyril E. King (St. Thomas)", city: "Charlotte Amalie", state: "VI" },
  { code: "SUN", name: "Friedman Memorial (Sun Valley)", city: "Hailey", state: "ID" },
  { code: "SUS", name: "Spirit of St. Louis", city: "Chesterfield", state: "MO" },
  { code: "SUX", name: "Sioux Gateway", city: "Sioux City", state: "IA" },
  { code: "SYR", name: "Syracuse Hancock", city: "Syracuse", state: "NY" },
  { code: "TLH", name: "Tallahassee International", city: "Tallahassee", state: "FL" },
  { code: "TUL", name: "Tulsa International", city: "Tulsa", state: "OK" },
  { code: "TUS", name: "Tucson International", city: "Tucson", state: "AZ" },
  { code: "TVC", name: "Cherry Capital (Traverse City)", city: "Traverse City", state: "MI" },
  { code: "TYS", name: "McGhee Tyson (Knoxville)", city: "Knoxville", state: "TN" },
  { code: "VPS", name: "Destin-Fort Walton Beach", city: "Valparaiso", state: "FL" },
  { code: "XNA", name: "Northwest Arkansas National", city: "Bentonville", state: "AR" },
];

// Lowercase haystack for fast case-insensitive search.
const HAYSTACK = US_AIRPORTS.map((a) => ({
  ...a,
  _h: `${a.code} ${a.name} ${a.city} ${a.state}`.toLowerCase(),
}));

export function searchAirports(query: string, limit = 8): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // Exact code match first (typing "TVC" should always land Cherry Capital).
  const exact = HAYSTACK.filter((a) => a.code.toLowerCase() === q);
  if (exact.length) return exact.map(({ _h, ...rest }) => rest);
  const matches = HAYSTACK.filter((a) => a._h.includes(q));
  // Bias toward 3-letter prefix matches at the top — "tv" should
  // surface TVC before any random TVC-containing city name.
  matches.sort((a, b) => {
    const ap = a.code.toLowerCase().startsWith(q) ? 0 : 1;
    const bp = b.code.toLowerCase().startsWith(q) ? 0 : 1;
    return ap - bp;
  });
  return matches.slice(0, limit).map(({ _h, ...rest }) => rest);
}

export function airportByCode(code: string): Airport | null {
  const c = code.trim().toUpperCase();
  return US_AIRPORTS.find((a) => a.code === c) ?? null;
}
