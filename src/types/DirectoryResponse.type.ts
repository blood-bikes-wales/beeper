import type { VolunteerPropertyType } from "./VolunteerPropertyType.enum";

export type VolunteerProperty = {
	code: string;
	id: number;
	name: string;
	type: VolunteerPropertyType;
	value: string;
};

export type VolunteerType = {
	name: string;
	volunteer_properties: VolunteerProperty[];
};

export type VolunteerResponseType = {
	volunteer: VolunteerType;
};

export type VolunteersResponseType = {
	volunteers: VolunteerType[];
};
