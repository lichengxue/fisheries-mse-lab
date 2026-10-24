# Model equations and annual timing

The simulator is a combined-sex, annual age-structured stock. Ages are 1 through A, where A is a plus group. Weight and maturity depend on age. Fishing selectivity is knife-edge by age. The presets are illustrative; they are not estimates for actual stocks.

## Historical phase

The initial true population is the unfished age distribution, scaled to unfished spawning biomass SSB0 = 1,000 tonnes.

For each supplied historical year t:

1. Calculate starting spawning biomass, S[t] = sum(N[a,t] × weight[a] × maturity[a]).
2. Observe S[t] with the survey model when a survey is scheduled.
3. Update the manager's estimated state.
4. Apply the supplied F[t] directly to the true population: F[a,t] = F[t] × selectivity[a].
5. Calculate catch using the Baranov equation and report it to the estimator.
6. Survive and age the true population, adding expected Beverton–Holt recruits as age 1 next year.

```text
N[a+1,t+1] = N[a,t] exp(-M - F[a,t])

The terminal plus group retains its own survivors as well as the
survivors entering from the preceding age.

Catch[t] = sum over ages of:
  N[a,t] × weight[a] × F[a,t]/(M + F[a,t]) × (1 - exp(-M - F[a,t]))

Expected R[t+1] = 4 h R0 S[t] / (SSB0(1-h) + (5h-1)S[t])
```

h is steepness: expected recruitment relative to R0 when SSB = 20% SSB0. Recruitment enters age 1 next year. Historical recruitment is deterministic in this version, so editing only survey noise does not change true historical stock dynamics.

The supplied annual historical F vector is not an HCR. It is the forcing input used to generate true population history. Catch and population abundance are outputs of that history.

## Handoff and future phase

The final historical age vector becomes the true state at projection year 0, without rescaling to a chosen depletion. Each replicate's estimated state is conditioned on historical noisy surveys and perfectly reported catch. All future strategies in that replicate share copies of this state and the same true historical endpoint.

In each future year, the survey and estimator produce an estimated state. An HCR generates a catch quota, either directly or by converting a target F through estimated abundance. Implementation error changes intended catch. The model solves for actual F against true abundance, capped at 3/year, then survives, ages and recruits the population.

Future recruitment is the same Beverton–Holt mean multiplied by mean-one lognormal error:

```text
multiplier = exp(sigma × z - sigma²/2)
sigma² = log(1 + CV²), z ~ Normal(0,1)
```

Survey and implementation error use the same mean-one construction with separate random draws. Survey timing continues across the historical handoff. The smoothed catch rule uses the final historical catch as its first change-cap baseline.

The estimator receives simulated surveys and reported catch, never true numbers at age or true historical F. Direct and averaged-survey estimators use an assumed unfished age shape when converting target F to a quota; the age-structured filter supplies its own estimated ages.

## Reference points and comparison

Equilibrium survivorship and the BH relationship determine abundance at each candidate constant F. Baranov catch gives equilibrium yield. A grid search and numerical refinement maximize that yield to calculate FMSY, MSY and SSBMSY. These deterministic biological reference points do not change merely because the historical F vector changes.

The crossing-risk metric counts projection years 1 through the chosen horizon; it excludes historical years and the projection-start state. Mean catch averages all projection years and futures. Bands are pointwise 10th–90th percentiles across futures, not confidence intervals for the median. Reported FMSY is an illustrative model benchmark, not stock-specific advice.

## Economic postprocessing and stakeholder workshop

Model 1.3.0 retains actual catch and F for every future and projection year. This adds no random draws and changes no biological equations. `src/economics.js` applies editable accounting assumptions to these trajectories; `src/workshop.js` displays economic outcomes and an objective-scoring workshop. These modules do not alter biology, management advice or fleet behavior. See [the full equations and exercise](ECONOMICS_AND_WORKSHOP.txt). The interface labels landings-supported job-years as a proxy and separates calculated preference scores from participants’ recorded votes.
