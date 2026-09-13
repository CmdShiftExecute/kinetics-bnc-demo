/**
 * The market register's taxonomy: five sectors, their industries, and the project
 * types under each. The vocabulary is the generic construction-market taxonomy the
 * register uses; the nesting below is this demo's own, published on the Data basis
 * page. One row of the relevance matrix exists per (sector, industry, type) triple.
 *
 * The weights are the share of the register each node takes, relative to its siblings.
 */
import type { Sector } from './schema';

export interface TypeNode {
  type: string;
  weight: number;
}
export interface IndustryNode {
  industry: string;
  weight: number;
  types: TypeNode[];
}
export interface SectorNode {
  sector: Sector;
  weight: number;
  industries: IndustryNode[];
}

export const TAXONOMY: SectorNode[] = [
  {
    sector: 'Urban Construction',
    weight: 74,
    industries: [
      {
        industry: 'Buildings',
        weight: 46,
        types: [
          { type: 'High Rise (15+)', weight: 30 },
          { type: 'Mid Rise (4 - 14)', weight: 34 },
          { type: 'Low Rise (1 -3)', weight: 24 },
          { type: 'Data Center', weight: 4 },
          { type: 'Showroom', weight: 3 },
          { type: 'Service Centre', weight: 5 },
        ],
      },
      {
        industry: 'Hospitality',
        weight: 10,
        types: [
          { type: 'Hotel', weight: 55 },
          { type: 'Resort', weight: 25 },
          { type: 'Hotel Apartments', weight: 20 },
          { type: 'Serviced Apartments', weight: 12 },
        ],
      },
      {
        industry: 'Education',
        weight: 7,
        types: [
          { type: 'School', weight: 60 },
          { type: 'University / College', weight: 30 },
          { type: 'Library', weight: 10 },
          { type: 'Training Centre', weight: 12 },
        ],
      },
      {
        industry: 'Healthcare',
        weight: 6,
        types: [
          { type: 'Hospital', weight: 60 },
          { type: 'Medical / Research center', weight: 40 },
          { type: 'Clinic', weight: 25 },
        ],
      },
      {
        industry: 'Retail Facilities',
        weight: 6,
        types: [
          { type: 'Shopping Mall', weight: 70 },
          { type: 'Showroom', weight: 30 },
        ],
      },
      {
        industry: 'Leisure & Recreation Facilities',
        weight: 7,
        types: [
          { type: 'Park', weight: 30 },
          { type: 'Sports Club & Facilities', weight: 30 },
          { type: 'Stadium', weight: 10 },
          { type: 'Landmark, Museum & Galleries', weight: 20 },
          { type: 'Golf Course', weight: 10 },
          { type: 'Theme Park', weight: 8 },
        ],
      },
      {
        industry: 'Mega Urban Development',
        weight: 6,
        types: [{ type: 'Mega Urban Development', weight: 100 }],
      },
      {
        industry: 'Religious Buildings',
        weight: 3,
        types: [{ type: 'Mosque', weight: 100 }],
      },
      {
        industry: 'Infrastructure',
        weight: 5,
        types: [
          { type: 'Road', weight: 45 },
          { type: 'Bridge', weight: 20 },
          { type: 'Sewerage / Drainage Network', weight: 35 },
          { type: 'Pumping Station', weight: 15 },
          { type: 'Canal / Waterway', weight: 10 },
        ],
      },
      {
        industry: 'Service Facility',
        weight: 2,
        types: [
          { type: 'Service Centre', weight: 60 },
          { type: 'Data Center', weight: 40 },
        ],
      },
      {
        industry: 'Storage Facility',
        weight: 2,
        types: [
          { type: 'Warehouse / Tankages / Silos', weight: 60 },
          { type: 'Logistics Hub / Center', weight: 40 },
        ],
      },
    ],
  },
  {
    sector: 'Industrial',
    weight: 10,
    industries: [
      {
        industry: 'Manufacturing / Processing Facility',
        weight: 55,
        types: [
          { type: 'Factory / Plant / Farm', weight: 70 },
          { type: 'Light Industrial/Workshop', weight: 30 },
          { type: 'Food Processing Plant', weight: 18 },
          { type: 'Cold Store', weight: 10 },
        ],
      },
      {
        industry: 'Storage Facility',
        weight: 25,
        types: [
          { type: 'Warehouse / Tankages / Silos', weight: 65 },
          { type: 'Logistics Hub / Center', weight: 35 },
          { type: 'Cold Store', weight: 15 },
        ],
      },
      {
        industry: 'Mega Industrial Development',
        weight: 12,
        types: [{ type: 'Mega Industrial Development', weight: 100 }],
      },
      {
        industry: 'Service Facility',
        weight: 8,
        types: [
          { type: 'Research Centre', weight: 50 },
          { type: 'Data Center', weight: 50 },
        ],
      },
    ],
  },
  {
    sector: 'Oil, Gas and Fuels',
    weight: 5,
    industries: [
      {
        industry: 'Downstream: Oil & Gas Infrastructure',
        weight: 55,
        types: [
          { type: 'Gas / Petrol Station', weight: 55 },
          { type: 'Pipeline', weight: 20 },
          { type: 'Refinery', weight: 12 },
          { type: 'Warehouse / Tankages / Silos', weight: 30 },
          { type: 'Factory / Plant / Farm', weight: 15 },
        ],
      },
      {
        industry: 'Upstream: Oil & Gas Exploration and Production',
        weight: 25,
        types: [
          { type: 'Factory / Plant / Farm', weight: 50 },
          { type: 'Offshore Platform', weight: 30 },
          { type: 'Research Centre', weight: 20 },
        ],
      },
      {
        industry: 'Fuel Plants',
        weight: 20,
        types: [
          { type: 'Hydrogen Plants', weight: 60 },
          { type: 'Factory / Plant / Farm', weight: 40 },
        ],
      },
    ],
  },
  {
    sector: 'Transport',
    weight: 6,
    industries: [
      {
        industry: 'Aviation',
        weight: 25,
        types: [
          { type: 'Airport', weight: 60 },
          { type: 'Hangar facility', weight: 40 },
          { type: 'Air Cargo Terminal', weight: 25 },
        ],
      },
      {
        industry: 'Marine',
        weight: 20,
        types: [
          { type: 'Port & Harbor', weight: 55 },
          { type: 'Shipyard', weight: 20 },
          { type: 'Canal / Waterway', weight: 25 },
        ],
      },
      {
        industry: 'Rail',
        weight: 15,
        types: [
          { type: 'Railway', weight: 60 },
          { type: 'Metro Station', weight: 25 },
          { type: 'Rail Depot', weight: 15 },
        ],
      },
      {
        industry: 'Road',
        weight: 40,
        types: [
          { type: 'Road', weight: 60 },
          { type: 'Bridge', weight: 25 },
          { type: 'Tunnel', weight: 15 },
        ],
      },
    ],
  },
  {
    sector: 'Utilities',
    weight: 5,
    industries: [
      {
        industry: 'Power Plants',
        weight: 35,
        types: [
          { type: 'Renewable Energy Plant', weight: 65 },
          { type: 'Nuclear Power Plant', weight: 10 },
          { type: 'Substation', weight: 20 },
          { type: 'Factory / Plant / Farm', weight: 25 },
        ],
      },
      {
        industry: 'Distribution Network',
        weight: 30,
        types: [
          { type: 'Sewerage / Drainage Network', weight: 40 },
          { type: 'Pumping Station', weight: 35 },
          { type: 'Water Network', weight: 25 },
        ],
      },
      {
        industry: 'Dam / reservoir',
        weight: 15,
        types: [{ type: 'Dam / reservoir', weight: 100 }],
      },
      {
        industry: 'Other Utility Plants',
        weight: 20,
        types: [
          { type: 'Desalination Plant', weight: 35 },
          { type: 'Water Treatment Plant', weight: 30 },
          { type: 'Waste to Energy Plant', weight: 20 },
          { type: 'Pumping Station', weight: 15 },
        ],
      },
    ],
  },
];

/** Every (sector, industry, type) triple, in taxonomy order: the rows of the relevance matrix. */
export function matrixTriples(): { sector: Sector; industry: string; type: string }[] {
  const out: { sector: Sector; industry: string; type: string }[] = [];
  for (const s of TAXONOMY) for (const i of s.industries) for (const t of i.types) out.push({ sector: s.sector, industry: i.industry, type: t.type });
  return out;
}
