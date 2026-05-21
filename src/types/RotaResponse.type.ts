import type { RotaType } from ".";

export type Volunteer = {
	id: number;
	name: string;
};

export type Shift = {
	id: number;
	rota: RotaType;
	title: string;
	start_datetime: string | Date;
	duration: number;
	volunteers: Volunteer[];
};

export type RotaResponseType = {
	shifts: Shift[];
};
