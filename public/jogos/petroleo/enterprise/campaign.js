import { seededRandom } from '../modules/terrain.js';
import { RULES, TECHNOLOGIES } from './config.js';
import { createOperation, operationReport } from './simulation.js';
import { createRivals, rivalLimit, advanceRivals } from './rivals.js';
import { generateField } from './exploration.js';

export function seasonPlots(seed, season) {
  const random = seededRandom(seed + season * 4297);
  return Array.from({ length: 4 }, (_, id) => {
    const plotSeed = Math.floor(random() * 4294967296), field = generateField(plotSeed, Math.min(4, Math.floor(season / 2)));
    const average = field.totalOil / field.pockets.filter(p => p.kind === 'oil').length;
    return { id, seed: plotSeed, rating: average < 305 ? 1 : average < 355 ? 2 : 3, owner: null, paid: 0, launched: false };
  });
}
export function createCampaign(seed = 2026, legacyResearch = null) {
  const tech = Object.fromEntries(Object.keys(TECHNOLOGIES).map(key => [key, 0]));
  if (legacyResearch) for (const [oldKey, newKey] of [['scan', 'survey'], ['cargo', 'cargo'], ['tank', 'tank']]) {
    const value = legacyResearch[oldKey]; if (Number.isInteger(value) && value >= 0 && value <= 3) tech[newKey] = value;
  }
  return { seed: seed >>> 0, season: 0, region: 0, cash: RULES.initialWealth, debt: 0, shares: 0, tech, rivals: createRivals(), plots: seasonPlots(seed, 0), auction: null, shareAuctionDone: false, leased: null, history: [], finished: false, difficulty: 'relaxed', legacyImported: !!legacyResearch };
}
export function researchCost(campaign, key) { const item = TECHNOLOGIES[key]; return item ? item.base * (campaign.tech[key] + 1) : Infinity; }
export function buyTechnology(campaign, key) {
  const item = TECHNOLOGIES[key], cost = researchCost(campaign, key);
  if (campaign.finished || campaign.auction || campaign.leased !== null || !item || campaign.tech[key] >= item.max || campaign.cash < cost) return false;
  campaign.cash -= cost; campaign.tech[key]++; return true;
}
export function bank(campaign, action) {
  if (campaign.finished || campaign.auction || campaign.leased !== null) return false;
  if (action === 'borrow' && campaign.debt <= 4000) { campaign.cash += 1000; campaign.debt += 1000; return true; }
  if (action === 'repay' && campaign.debt > 0 && campaign.cash > 0) { const amount = Math.min(1000, campaign.debt, campaign.cash); campaign.cash -= amount; campaign.debt -= amount; return true; }
  return false;
}
export function startAuction(campaign, type, plotId = null) {
  if (campaign.finished || campaign.auction || campaign.leased !== null || !['plot', 'shares'].includes(type)) return false;
  if (type === 'shares' && campaign.shareAuctionDone) return false;
  const plot = campaign.plots[plotId];
  if (type === 'plot' && (!plot || plot.owner !== null || plotId === 3)) return false;
  campaign.auction = { type, plotId: type === 'plot' ? plotId : null, bid: type === 'plot' ? 300 : 400, leader: null, rounds: 0 };
  return true;
}
export function bid(campaign) {
  const auction = campaign.auction;
  if (!auction) return false;
  const amount = auction.leader === null ? auction.bid : auction.bid + 100;
  const reserve = auction.type === 'plot' ? RULES.operationBudget : RULES.operationBudget + 300;
  if (campaign.cash < amount + reserve) return false;
  auction.bid = amount; auction.leader = 'player'; auction.rounds++;
  const plot = auction.type === 'plot' ? campaign.plots[auction.plotId] : null;
  for (let i = 0; i < campaign.rivals.length; i++) {
    if (rivalLimit(campaign, i, auction.type, plot) >= auction.bid + 100) { auction.bid += 100; auction.leader = i; }
  }
  return true;
}
export function finishAuction(campaign) {
  const auction = campaign.auction;
  if (!auction) return false;
  // Passing without a bid still lets rivals compete at their own valuations.
  if (auction.leader === null) {
    const plot = auction.type === 'plot' ? campaign.plots[auction.plotId] : null;
    const offers = campaign.rivals.map((_, i) => ({ i, limit: rivalLimit(campaign, i, auction.type, plot) })).sort((a, b) => b.limit - a.limit);
    if (offers[0].limit >= auction.bid) { auction.leader = offers[0].i; auction.bid = Math.min(offers[0].limit, Math.max(auction.bid, offers[1].limit + 100)); }
  }
  if (auction.leader !== null) {
    const owner = auction.leader === 'player' ? campaign : campaign.rivals[auction.leader];
    if (owner.cash < auction.bid) return false;
    owner.cash -= auction.bid;
    if (auction.type === 'shares') owner.shares += 5;
    else { const plot = campaign.plots[auction.plotId]; plot.owner = auction.leader; plot.paid = auction.bid; if (auction.leader === 'player') campaign.leased = plot.id; }
  }
  if (auction.type === 'shares') campaign.shareAuctionDone = true;
  campaign.auction = null; return true;
}
export function leaseSafe(campaign) {
  if (campaign.finished || campaign.leased !== null || campaign.auction || campaign.cash < 300 + RULES.operationBudget) return false;
  const plot = campaign.plots[3]; plot.owner = 'player'; plot.paid = 300; campaign.cash -= 300; campaign.leased = 3; return true;
}
export function launchOperation(campaign) {
  if (campaign.finished || campaign.auction || campaign.leased === null || campaign.cash < RULES.operationBudget) return null;
  const plot = campaign.plots[campaign.leased];
  if (plot.owner !== 'player' || plot.launched) return null;
  plot.launched = true;
  campaign.cash -= RULES.operationBudget;
  return createOperation({ seed: plot.seed, region: campaign.region, tech: campaign.tech, difficulty: campaign.difficulty, season: campaign.season });
}
export function finishSeason(campaign, operation) {
  if (!operation?.ended || operation.settled || campaign.finished || operation.season !== campaign.season || campaign.leased === null || operation.seed !== campaign.plots[campaign.leased].seed) return false;
  const report = operationReport(operation);
  operation.settled = true;
  campaign.cash += operation.cash + report.reward;
  campaign.debt = Math.ceil(campaign.debt * 1.05);
  if (!campaign.shareAuctionDone) { startUnclaimedShares(campaign); }
  advanceRivals(campaign);
  campaign.history.push({ season: campaign.season, region: campaign.region, seed: operation.seed, profit: report.profit - campaign.plots[campaign.leased].paid, medals: report.medals.filter(Boolean).length, spilled: operation.spilled, sold: operation.sold, bonus: report.reward });
  campaign.season++;
  campaign.finished = campaign.season >= RULES.seasons;
  campaign.region = Math.min(4, Math.floor(campaign.season / 2));
  campaign.leased = null; campaign.shareAuctionDone = false; campaign.auction = null;
  campaign.plots = seasonPlots(campaign.seed, campaign.season); return true;
}
function startUnclaimedShares(campaign) {
  // A missed annual auction still occurs among rivals; it is never duplicated.
  const offers = campaign.rivals.map((_, i) => ({ i, limit: rivalLimit(campaign, i, 'shares') })).sort((a, b) => b.limit - a.limit);
  if (offers[0].limit < 400) return;
  const rival = campaign.rivals[offers[0].i], price = Math.min(offers[0].limit, Math.max(400, offers[1].limit + 100));
  rival.cash -= price; rival.shares += 5;
}
export function standings(campaign) {
  return [{ name: 'Você', shares: campaign.shares, wealth: campaign.cash - campaign.debt, player: true }, ...campaign.rivals.map(r => ({ name: r.name, shares: r.shares, wealth: r.cash, player: false }))].sort((a, b) => b.shares - a.shares || b.wealth - a.wealth);
}
