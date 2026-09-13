/**
 * How each vertical reaches a project. A vertical that is specified into a design sells
 * through consultants; one that is bought as a package sells through contractors; a few
 * sell both ways. This is the demo's own assumption, published on the Data basis page,
 * and it is the input to step 2 of the ownership cascade.
 */
import type { Channel, Slug } from './schema';

export const CHANNELS: Record<Slug, Channel> = {
  automation: 'both',
  cooling: 'consultants',
  'electrical-distribution': 'contractors',
  fabrication: 'contractors',
  'mechanical-systems': 'consultants',
  metering: 'consultants',
  'pumps-and-water': 'both',
  services: 'contractors',
  trading: 'contractors',
  'vertical-transport': 'consultants',
};
