/**
 * @name views.upcomingFreeAgents
 * @namespace List of upcoming free agents.
 */
define(["db", "globals", "ui", "core/freeAgents", "core/player", "lib/jquery", "lib/knockout", "lib/underscore", "util/bbgmView", "util/helpers", "util/viewHelpers"], function (db, g, ui, freeAgents, player, $, ko, _, bbgmView, helpers, viewHelpers) {
    "use strict";

    var mapping;

    function get(req) {
        return {
            season: helpers.validateSeason(req.params.season)
        };
    }

    mapping = {
        players: {
            create: function (options) {
                return options.data;
            }
        }
    };

    function updateUpcomingFreeAgents(inputs) {
        var deferred, players, playersAll;

        deferred = $.Deferred();

        playersAll = [];

        g.dbl.transaction("players").objectStore("players").index("tid").openCursor(IDBKeyRange.lowerBound(0)).onsuccess = function (event) {
            var cursor, i, p;

            cursor = event.target.result;
            if (cursor) {
                p = cursor.value;
                if (p.contract.exp === inputs.season) {
                    playersAll.push(p);
                }
                cursor.continue();
            } else {
                // Done before filter so full player object can be passed to player.genContract.
                for (i = 0; i < playersAll.length; i++) {
                    playersAll[i].contractDesired = player.genContract(playersAll[i]);
                    playersAll[i].contractDesired.amount /= 1000;
                }

                players = player.filter(playersAll, {
                    attrs: ["pid", "name", "pos", "age", "contract", "freeAgentMood", "injury", "watch", "contractDesired"],
                    ratings: ["ovr", "pot", "skills"],
                    stats: ["min", "pts", "trb", "ast", "per"],
                    season: inputs.season,
                    showNoStats: true,
                    showRookies: true,
                    fuzz: true,
                    oldStats: true
                });

                for (i = 0; i < players.length; i++) {
                    players[i].mood = player.moodColorText(players[i]);
                }

                deferred.resolve({
                    players: players
                });
            }
        };

        return deferred.promise();
    }

    function uiFirst(vm) {
        ui.title("Upcoming Free Agents");


        ko.computed(function () {
            ui.datatable($("#upcoming-free-agents"), 4, _.map(vm.players(), function (p) {
                // The display: none for mood allows sorting, somehow
                return [helpers.playerNameLabels(p.pid, p.name, p.injury, p.ratings.skills, p.watch), p.pos, String(p.age), String(p.ratings.ovr), String(p.ratings.pot), helpers.round(p.stats.min, 1), helpers.round(p.stats.pts, 1), helpers.round(p.stats.trb, 1), helpers.round(p.stats.ast, 1), helpers.round(p.stats.per, 1), helpers.formatCurrency(p.contract.amount, "M") + ' thru ' + p.contract.exp, helpers.formatCurrency(p.contractDesired.amount, "M") + ' thru ' + p.contractDesired.exp, '<div title="' + p.mood.text + '" style="width: 100%; height: 21px; background-color: ' + p.mood.color + '"><span style="display: none">' + p.freeAgentMood[g.userTid] + '</span></div>'];
            }));
        }).extend({throttle: 1});

        ui.tableClickableRows($("#upcoming-free-agents"));
    }

    return bbgmView.init({
        id: "upcomingFreeAgents",
        get: get,
        mapping: mapping,
        runBefore: [updateUpcomingFreeAgents],
        uiFirst: uiFirst
    });
});