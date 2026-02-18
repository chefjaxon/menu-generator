// Protein groups feature placeholder - not currently active
// These functions exist for API route compatibility

export interface ProteinGroup {
  id: string;
  name: string;
  members: string[];
}

export async function getAllProteinGroups(): Promise<ProteinGroup[]> {
  return [];
}

export async function getProteinGroupById(_id: string): Promise<ProteinGroup | null> {
  return null;
}

export async function getProteinGroupByName(_name: string): Promise<ProteinGroup | null> {
  return null;
}

export async function createProteinGroup(_name: string, _members: string[]): Promise<ProteinGroup> {
  throw new Error('Protein groups feature not available');
}

export async function updateProteinGroup(_id: string, _name: string, _members: string[]): Promise<ProteinGroup | null> {
  return null;
}

export async function deleteProteinGroup(_id: string): Promise<boolean> {
  return false;
}

export async function getGroupsForProtein(_protein: string): Promise<ProteinGroup[]> {
  return [];
}
