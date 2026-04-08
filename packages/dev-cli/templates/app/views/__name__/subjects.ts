export const SUBJECTS = {
	ping: (orgId: string) => `khal.${orgId}.{{name}}.ping`,
} as const;
