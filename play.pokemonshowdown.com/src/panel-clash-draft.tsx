import {PS, PSRoom, type RoomOptions} from "./client-main";
import {PSPanelWrapper, PSRoomPanel} from "./panels";
import type {Args} from "./battle-text-parser";
import {Dex} from "./battle-dex";

interface DraftPokemonSet {
	name?: string;
	species: string;
	item?: string;
	ability?: string;
	moves: string[];
	nature?: string;
	evs?: Record<string, number>;
	ivs?: Record<string, number>;
	level?: number;
	teraType?: string;
}

interface DraftPackInfo {
	id: string;
	name: string;
	description: string;
}

interface ClashDraftState {
	phase:
		| 'pack-selection'
		| 'coin-toss'
		| 'drafting'
		| 'complete';

	opponentName: string;
	opponentAvatar: string ;

	availablePacks: DraftPackInfo[];

	yourPack: {
		id: string;
		name: string;
	} | null;

	opponentHasChosenPack: boolean;

	opponentPackName: string | null;

	selectedPackName: string | null;

	coinTossWinner:
		| 'p1'
		| 'p2'
		| null;

	round: number;

	offer: [
		DraftPokemonSet,
		DraftPokemonSet
	] | null;

	chosenTeam:
		DraftPokemonSet[];

	hasChosen: boolean;

    currentChoice: 0 | 1 | null;

	roundDeadline:
		number | null;
}


class ClashDraftRoom extends PSRoom {
	override readonly classType: string = 'clashdraft';

	draftState: ClashDraftState | null = null;

	constructor(options: RoomOptions) {
		super(options);

		this.title = 'VGC Clash Draft';
	}

    override interruptClose(
        explicit?: boolean,
        elem?: HTMLElement | null
    ) {

        /*
        * If this isn't an active draft panel for some
        * reason, just allow normal closing.
        */
        if (!this.draftState) {
            return super.interruptClose(
                explicit,
                elem
            );
        }


        void PS.confirm(
            `Closing this tab will forfeit the Clash Draft. Are you sure?`,
            {
                parentElem: elem ?? undefined,
                okButton: 'Forfeit',
            }
        ).then(confirmed => {

            if (!confirmed) return;


            /*
            * Tell our custom server logic that
            * this player forfeited.
            */
            PS.send('/draftforfeit');


            /*
            * Actually close the panel locally.
            *
            * Calling PS.leave() directly avoids
            * invoking interruptClose() a second time.
            */
            PS.leave(this.id);

        });


        /*
        * Prevent Showdown's original close operation.
        * We'll close it ourselves after confirmation.
        */
        return true;
    }

	override receiveLine(args: Args) {

		switch (args[0]) {

		case 'draftstate':

			try {
				this.draftState =
					JSON.parse(args[1]);

				this.update(null);

			} catch (error) {

				console.error(
					'Failed to parse Clash Draft state:',
					error
				);
			}

			break;


		default:
			super.receiveLine(args);
			break;
		}
	}
}


class ClashDraftPanel extends PSRoomPanel<ClashDraftRoom> {
	static readonly id = 'clashdraft';

	static readonly routes = [
		'clashdraft',
		'clashdraft-*',
	];

	static readonly Model = ClashDraftRoom;

	static readonly title = 'VGC Clash Draft';

    renderOfferSprite(mon: DraftPokemonSet) {
	const sprite = Dex.getSpriteData(
		mon.species,
		true,
		{
			gen: 9,
			mod: 'champions',
		}
	);

	if (!sprite.url) return null;

	return <img
		class="clash-draft-offer-sprite"
		src={sprite.url}
		alt={mon.species}
	/>;
    }


    renderTeamSprite(mon: DraftPokemonSet) {
        const sprite = Dex.getTeambuilderSpriteData(
            mon,
            Dex.mod('champions' as any)
        );

        const shiny = sprite.shiny
            ? '-shiny'
            : '';

        const url =
            `${Dex.resourcePrefix}` +
            `${sprite.spriteDir}` +
            `${shiny}/` +
            `${sprite.spriteid}.png`;

        return <img
            class="clash-draft-team-sprite"
            src={url}
            alt={mon.species}
        />;
    }

    renderSetTooltip(mon: DraftPokemonSet) {
        const statNames: Record<string, string> = {
            hp: 'HP',
            atk: 'Atk',
            def: 'Def',
            spa: 'SpA',
            spd: 'SpD',
            spe: 'Spe',
        };

        const formatStats = (
            stats: Record<string, number> | undefined,
            showAll = false
        ) => {
            if (!stats) return '';

            return Object.entries(stats)
                .filter(([, value]) => showAll || value !== 0)
                .map(([stat, value]) =>
                    `${value} ${statNames[stat] ?? stat}`
                )
                .join(' / ');
        };

        const evText = formatStats(mon.evs);

        /*
        * IVs are part of the complete set, so display them.
        */
        const ivText = formatStats(mon.ivs, true);

        return <div class="clash-draft-set-tooltip">

            <div class="clash-draft-tooltip-title">
                {mon.species}

                {mon.level &&
                    <span class="clash-draft-tooltip-level">
                        {' '}Lv. {mon.level}
                    </span>
                }
            </div>


            <div class="clash-draft-tooltip-info">

                {mon.item &&
                    <div>
                        <strong>Item:</strong> {mon.item}
                    </div>
                }

                {mon.ability &&
                    <div>
                        <strong>Ability:</strong> {mon.ability}
                    </div>
                }

                {mon.teraType &&
                    <div>
                        <strong>Tera Type:</strong> {mon.teraType}
                    </div>
                }

            </div>


            {mon.nature &&
                <div class="clash-draft-tooltip-stats">
                    <strong>Nature:</strong> {mon.nature}
                </div>
            }



            <div class="clash-draft-tooltip-moves">
                {mon.moves.map(move =>
                    <div key={move}>
                        • {move}
                    </div>
                )}
            </div>

        </div>;
    }

    renderCommonDraftUI(
        state: ClashDraftState
    ) {
        return <>

            <div class="clash-draft-red-bg" />
            <div class="clash-draft-blue-bg" />


            <div class="clash-draft-opponent">

                <div class="clash-draft-opponent-avatar">
                    <img
                        src={Dex.resolveAvatar(
                            state.opponentAvatar || 'unknown'
                        )}
                        alt={state.opponentName}
                    />
                </div>

                <div class="clash-draft-opponent-name">
                    {state.opponentName}
                </div>

            </div>

        </>;
    }

    renderDraft(
        room: ClashDraftRoom,
        state: ClashDraftState
    ) {
        const visibleChosenTeam = [...state.chosenTeam];
        if (
            state.currentChoice !== null &&
            state.offer
        ) {
            visibleChosenTeam.push(
                state.offer[state.currentChoice]
            );
        }

        const timer = this.getDraftTimer(
            state.roundDeadline
        );

        return <PSPanelWrapper room={room}>
            <div class="clash-draft-scroll">
                <div class="clash-draft">

                    {this.renderCommonDraftUI(state)}

                    <div class="clash-draft-pack">
                        Pack: <strong>{state.selectedPackName}</strong>
                    </div>

                    <div class="clash-draft-round">
                        Round {state.round} / 3
                    </div>

                    <h2 class="clash-draft-status">
                        {
                            state.phase === 'complete'
                                ? 'Draft Complete!'
                                : state.hasChosen
                                    ? 'Waiting for opponent'
                                    : 'Pick your Pokémon'
                        }
                    </h2>

                    {timer &&
                        <div
                            class={
                                'clash-draft-timer' +
                                (timer.seconds <= 5
                                    ? ' clash-draft-timer-warning'
                                    : '')
                            }
                        >
                            {timer.text}
                        </div>
                    }

                    <div class="clash-draft-drafting-content">

                        {/* Offers */}
                        <div class="clash-draft-offers">

                            {state.offer && <>
                                <button
                                    class="clash-draft-card clash-draft-tooltip-target"
                                    disabled={state.hasChosen}
                                    onClick={() => PS.send('/draftpick 1')}
                                >
                                    <div class="clash-draft-card-sprite">
                                        {this.renderOfferSprite(state.offer[0])}
                                    </div>

                                    <div class="clash-draft-card-name">
                                        {state.offer[0].species}
                                    </div>

                                    {this.renderSetTooltip(state.offer[0])}

                                </button>


                                <button
                                    class="clash-draft-card clash-draft-tooltip-target"
                                    disabled={state.hasChosen}
                                    onClick={() => PS.send('/draftpick 2')}
                                >
                                    <div class="clash-draft-card-sprite">
                                        {this.renderOfferSprite(state.offer[1])}
                                    </div>

                                    <div class="clash-draft-card-name">
                                        {state.offer[1].species}
                                    </div>

                                    {this.renderSetTooltip(state.offer[1])}

                                </button>
                            </>}

                        </div>


                        {/* Team preview */}
                        <div class="clash-draft-team">

                            {[0, 1, 2, 3, 4, 5].map(index => {

                                const mon = visibleChosenTeam[index];

                                return <div
                                    class={
                                        'clash-draft-team-slot' +
                                        (mon ? ' clash-draft-tooltip-target' : '')
                                    }
                                    key={index}
                                >

                                    {mon ? <>

                                        <div class="clash-draft-team-sprite-container">
                                            {this.renderTeamSprite(mon)}
                                        </div>

                                        <div class="clash-draft-team-name">
                                            {mon.species}
                                        </div>


                                        {/* Held item */}
                                        {mon.item &&

                                            <div
                                                class="clash-draft-item-badge"
                                                title={mon.item}
                                            >
                                                <span
                                                    class="clash-draft-item-icon"
                                                    style={Dex.getItemIcon(mon.item) as any}
                                                />
                                            </div>

                                        }

                                        {/* Full set tooltip */}
	                                    {this.renderSetTooltip(mon)}

                                    </> :

                                        <div class="clash-draft-question">
                                            ?
                                        </div>

                                    }

                                </div>;

                            })}

                        </div>

                    </div>

                </div>
            </div>
        </PSPanelWrapper>;
    }

    renderPackSelection(
        room: ClashDraftRoom,
        state: ClashDraftState
    ) {
        return <PSPanelWrapper room={room}>
            <div class="clash-draft">

                {this.renderCommonDraftUI(state)}

                {/* Phase title */}
                <div class="clash-draft-phase-title">
                    Pack Selection
                </div>


                <h2 class="clash-draft-status">
                    {
                        state.yourPack
                            ? 'Waiting for opponent'
                            : 'Choose your Pack'
                    }
                </h2>


                {
                    state.yourPack ?

                        <div class="clash-draft-pack-locked">

                            <div class="clash-draft-pack-locked-label">
                                Your Pack
                            </div>

                            <div class="clash-draft-pack-locked-name">
                                {state.yourPack.name}
                            </div>

                            <div class="clash-draft-pack-lock-icon">
                                ✓
                            </div>

                            <div class="clash-draft-pack-waiting">
                                {
                                    state.opponentHasChosenPack
                                        ? 'Opponent has locked in'
                                        : 'Opponent is choosing...'
                                }
                            </div>

                        </div>

                    :

                        <div class="clash-draft-pack-list">

                            {state.availablePacks.map(pack =>

                                <button
                                    key={pack.id}
                                    class="clash-draft-pack-card"
                                    onClick={() =>
                                        PS.send(`/draftpack ${pack.id}`)
                                    }
                                >

                                    <div class="clash-draft-pack-card-name">
                                        {pack.name}
                                    </div>

                                    <div class="clash-draft-pack-card-description">
                                        {pack.description}
                                    </div>

                                    <div class="clash-draft-pack-card-select">
                                        SELECT
                                    </div>

                                </button>

                            )}

                        </div>
                }

            </div>
        </PSPanelWrapper>;
    }

    renderCoinToss(
        room: ClashDraftRoom,
        state: ClashDraftState
    ) {
        return <PSPanelWrapper room={room}>
            <div class="clash-draft">

                {this.renderCommonDraftUI(state)}

                <div class="clash-draft-phase-title">
                    Coin Toss
                </div>


                <h2 class="clash-draft-status">
                    Selecting Draft Pack
                </h2>


                <div class="clash-draft-toss-area">


                    {/* Your pack */}
                    <div
                        class={
                            'clash-draft-toss-pack' +
                            (
                                state.selectedPackName === state.yourPack?.name
                                    ? ' clash-draft-toss-winner'
                                    : ''
                            )
                        }
                    >

                        <div class="clash-draft-toss-owner">
                            Your Pack
                        </div>

                        <div class="clash-draft-toss-pack-name">
                            {state.yourPack?.name}
                        </div>

                    </div>


                    {/* Coin */}
                    <div class="clash-draft-coin-container">

                        <div
                            class={
                                'clash-draft-coin ' +
                                (
                                    state.selectedPackName
                                        ? 'clash-draft-coin-landed'
                                        : 'clash-draft-coin-flipping'
                                )
                            }
                        >
                            <span>★</span>
                        </div>


                        <div class="clash-draft-toss-result">

                            {state.selectedPackName
                                ? `${state.selectedPackName} wins!`
                                : 'Flipping...'}

                        </div>

                    </div>


                    {/* Opponent pack */}
                    <div
                        class={
                            'clash-draft-toss-pack' +
                            (
                                state.selectedPackName === state.opponentPackName
                                    ? ' clash-draft-toss-winner'
                                    : ''
                            )
                        }
                    >

                        <div class="clash-draft-toss-owner">
                            Opponent's Pack
                        </div>

                        <div class="clash-draft-toss-pack-name">
                            {state.opponentPackName}
                        </div>

                    </div>

                </div>

            </div>
        </PSPanelWrapper>;
    }

    override render() {
        const room =
            this.props.room;

        const state =
            room.draftState;

        if (!state) {
            return <PSPanelWrapper room={room}>
                <div>
                    Waiting for draft data...
                </div>
            </PSPanelWrapper>;
        }

        if (
            state.phase === 'pack-selection'
        ) {
            return this.renderPackSelection(
                room,
                state
            );
        }

        if (
            state.phase === 'coin-toss'
        ) {
            return this.renderCoinToss(
                room,
                state
            );
        }

        return this.renderDraft(
            room,
            state
        );
    }

    timerInterval: ReturnType<typeof setInterval> | null = null;

    override componentDidMount() {
        super.componentDidMount();

        this.timerInterval = setInterval(() => {
            const state = this.props.room.draftState;

            if (
                state?.phase === 'drafting' &&
                state.roundDeadline !== null
            ) {
                this.forceUpdate();
            }
        }, 250);
    }

    override componentWillUnmount() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        super.componentWillUnmount();
    }

    getDraftTimer(deadline: number | null): {
        text: string;
        seconds: number;
    } | null {
        if (deadline === null) return null;

        const millisecondsLeft = Math.max(
            0,
            deadline - Date.now()
        );

        const seconds = Math.ceil(
            millisecondsLeft / 1000
        );

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return {
            seconds,
            text:
                `${minutes}:` +
                `${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`
        };
    }
}




PS.addRoomType(ClashDraftPanel);