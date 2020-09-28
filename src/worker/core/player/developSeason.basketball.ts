import limitRating from "./limitRating";
import { g, helpers, random } from "../../util";
import type {
	PlayerRatings,
	RatingKey,
} from "../../../common/types.basketball";

type RatingFormula = {
	ageModifier: (age: number) => number;
	changeLimits: (age: number) => [number, number];
};

const shootingFormula: RatingFormula = {
	ageModifier: (age: number) => {
		// Reverse most of the age-related decline in calcBaseChange
		if (age <= 27) {
			return 0;
		}

		if (age <= 29) {
			return 0.5;
		}

		if (age <= 31) {
			return 1.5;
		}

		return 2;
	},
	changeLimits: () => [-3, 13],
};
const iqFormula: RatingFormula = {
	ageModifier: (age: number) => {
		if (age <= 21) {
			return 4;
		}

		if (age <= 23) {
			return 3;
		}

		// Reverse most of the age-related decline in calcBaseChange
		if (age <= 27) {
			return 0;
		}

		if (age <= 29) {
			return 0.5;
		}

		if (age <= 31) {
			return 1.5;
		}

		return 2;
	},
	changeLimits: age => {
		if (age > 24) {
			return [-3, 9];
		}

		// For 19: [-3, 32]
		// For 23: [-3, 12]
		return [-3, 7 + 5 * (24 - age)];
	},
};
const ratingsFormulas: Record<Exclude<RatingKey, "hgt">, RatingFormula> = {
	stre: {
		ageModifier: () => 0,
		changeLimits: () => [-Infinity, Infinity],
	},
	spd: {
		ageModifier: (age: number) => {
			if (age <= 27) {
				return 0;
			}

			if (age <= 30) {
				return -2;
			}

			if (age <= 35) {
				return -3;
			}

			if (age <= 40) {
				return -4;
			}

			return -8;
		},
		changeLimits: () => [-12, 2],
	},
	jmp: {
		ageModifier: (age: number) => {
			if (age <= 26) {
				return 0;
			}

			if (age <= 30) {
				return -3;
			}

			if (age <= 35) {
				return -4;
			}

			if (age <= 40) {
				return -5;
			}

			return -10;
		},
		changeLimits: () => [-12, 2],
	},
	endu: {
		ageModifier: (age: number) => {
			if (age <= 23) {
				return random.uniform(0, 9);
			}

			if (age <= 30) {
				return 0;
			}

			if (age <= 35) {
				return -2;
			}

			if (age <= 40) {
				return -4;
			}

			return -8;
		},
		changeLimits: () => [-11, 19],
	},
	dnk: {
		ageModifier: (age: number) => {
			// Like shootingForumla, except for old players
			if (age <= 27) {
				return 0;
			}

			return 0.5;
		},
		changeLimits: () => [-3, 13],
	},
	ins: shootingFormula,
	ft: shootingFormula,
	fg: shootingFormula,
	tp: shootingFormula,
	oiq: iqFormula,
	diq: iqFormula,
	drb: {
		ageModifier: shootingFormula.ageModifier,
		changeLimits: () => [-2, 5],
	},
	pss: {
		ageModifier: shootingFormula.ageModifier,
		changeLimits: () => [-2, 5],
	},
	reb: {
		ageModifier: shootingFormula.ageModifier,
		changeLimits: () => [-2, 5],
	},
};

const calcBaseChange = (age: number, coachingRank: number): number => {
	let val: number;

	if (age <= 21) {
		val = 2;
	} else if (age <= 25) {
		val = 1;
	} else if (age <= 27) {
		val = 0;
	} else if (age <= 29) {
		val = -1;
	} else if (age <= 31) {
		val = -2;
	} else if (age <= 34) {
		val = -3;
	} else if (age <= 40) {
		val = -4;
	} else if (age <= 43) {
		val = -5;
	} else {
		val = -6;
	}

	// Noise
	const mult = 1.732; // sqrt(3)
	if (age <= 23) {
		val += helpers.bound(random.realGauss(0, 5 * mult), -4 * mult, 20 * mult);
	} else if (age <= 25) {
		val += helpers.bound(random.realGauss(0, 5 * mult), -4 * mult, 10 * mult);
	} else {
		val += helpers.bound(random.realGauss(0, 3 * mult), -2 * mult, 4 * mult);
	}

	// Modulate by coaching. g.get("numActiveTeams") doesn't exist when upgrading DB, but that doesn't matter
	if (g.hasOwnProperty("numActiveTeams")) {
		if (val >= 0) {
			val *= ((coachingRank - 1) * -0.5) / (g.get("numActiveTeams") - 1) + 1.25;
		} else {
			val *= ((coachingRank - 1) * 0.5) / (g.get("numActiveTeams") - 1) + 0.75;
		}
	}

	return val;
};

const developSeason = (
	ratings: PlayerRatings,
	age: number,
	coachingRank: number = (g.get("numActiveTeams") + 1) / 2,
) => {
	// In young players, height can sometimes increase
	if (age <= 21) {
		const heightRand = Math.random();

		if (heightRand > 0.99 && age <= 20 && ratings.hgt <= 99) {
			ratings.hgt += 1;
		}

		if (heightRand > 0.999 && ratings.hgt <= 99) {
			ratings.hgt += 1;
		}
	}

	const baseChangeA = calcBaseChange(age, coachingRank);
	const baseChangeS = calcBaseChange(age, coachingRank);
	const baseChangeZ = calcBaseChange(age, coachingRank);

	const ratingsNumbers: Record<Exclude<RatingKey, "hgt">, number> = {
		stre: baseChangeA,
		spd: baseChangeA,
		jmp: baseChangeA,
		endu: baseChangeA,
		dnk: baseChangeS,
		ins: baseChangeS,
		ft: baseChangeS,
		fg: baseChangeS,
		tp: baseChangeS,
		oiq: baseChangeZ,
		diq: baseChangeZ,
		drb: baseChangeZ,
		pss: baseChangeZ,
		reb: baseChangeZ,
	};

	for (const key of helpers.keys(ratingsFormulas)) {
		const ageModifier = ratingsFormulas[key].ageModifier(age);
		const changeLimits = ratingsFormulas[key].changeLimits(age);

		ratings[key] = limitRating(
			ratings[key] +
				helpers.bound(
					(ratingsNumbers[key] + ageModifier) * random.uniform(0.4, 1.4),
					changeLimits[0],
					changeLimits[1],
				),
		);
	}
};

export default developSeason;
