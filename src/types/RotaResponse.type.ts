import type { RotaType } from ".";

export type Shift = {
	id: number;
	rota: RotaType;
	title: string;
	start_datetime: string | Date;
	duration: number;
	volunteers: { id: number; name: string }[];
};

export type RotaResponseType = {
	shifts: Shift[];
};
