# Model equations and annual timing

The simulator is a combined-sex, annual age-structured stock. Ages are 1 through A, where A is a plus group. Weight and maturity depend on age. Fishing selectivity is knife-edge by age. The presets are illustrative; they are not estimates for actual stocks.

## Historical phase

The initial true population is the unfished age distribution, scaled to unfished spawning biomass SSB0 = 1,000 tonnes.

For each supplied historical year t:

1. Calculate starting spawning biomass, S[t] = sum(N[a,t] × weight[a] × maturity[a]).
2. Generate a relative survey-selected biomass index and/or an age sample when a survey is scheduled.
3. Fit the manager's assessment using the available observations.
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

The assessment receives simulated survey observations and lagged reported total catch, never true numbers at age or true historical F. The age-structured assessment supplies estimated ages to F-based fishing rules. The two index shortcuts instead use an assumed unfished age shape.

## Survey data: index and age composition

A survey can provide an index, an age sample, or both in the same visit. Survey selectivity is one from the chosen minimum survey age onward and zero below it. It is separate from fishing selectivity. Observations occur at the beginning of each year, before fishing.

```text
Bsurvey[t] = sum(survey_selectivity[a] × N[a,t] × weight[a])
I[t] = true_q × Bsurvey[t] × (1 + survey_bias) × exp(sigma*z - sigma²/2)
sigma² = log(1 + index_CV²)

p[a,t] = survey_selectivity[a] × N[a,t] / sum(survey_selectivity × N)
age_counts[t] ~ Multinomial(effective_sample_size, p[,t])
```

The index is in relative index units, **not tonnes of SSB**. Its scale defaults to q = 0.1 index units per tonne of selected biomass. Ages describe sampled **numbers**, not biomass. Larger effective samples reduce age-sampling noise; changing index CV does not change those counts. Age samples assume independent fish and no ageing error. In real surveys nominal sample size can overstate effective information because fish from a tow are correlated. The terminal age is a plus group.

Age draws use a separate deterministic random stream. Recruitment, index-error and implementation draws do not change when age sampling is enabled. Within a replicate and year, strategies share the same underlying random uniforms; their age counts differ as their populations diverge. Historical and projection streams are separate.

## Explicit age-structured assessment (default)

This is a **simplified sequential penalized-likelihood assessment**, implemented in this repository for teaching. It is not Stock Synthesis, ASAP, or a full retrospective catch-at-age fit.

The assessment maintains its own numbers at age and independent log-abundance variances. It initializes with its assumed unfished age structure and log variance 0.36 at each age. Assumed M can differ from true M; the assumed stock is recalibrated to the same known unfished SSB of 1,000 t. At each year:

1. Predict numbers at age using last year's fitted ages, Baranov inversion of the **previous reported total catch**, age-specific survival, the plus group and expected Beverton–Holt recruitment. The assessment does not receive future catches or true fishing mortality.
2. Fit current log numbers at age to the current relative index and, when enabled, survey age counts. The biological prediction is a penalty, so observed age composition can change the age pattern rather than merely rescale it.
3. Report fitted numbers at age, SSB = sum(N × weight × maturity), fitted survey index and age proportions. The fitted state enters the HCR. The previous catch inversion also supplies a lagged estimated F. A capacity mismatch is flagged when the predicted population cannot explain the previous catch within F ≤ 3/year.

For x[a] = log N[a], predicted log numbers mu[a], and predicted variances P[a], the annual objective, ignoring constants, is:

```text
L(x) = sum((x[a] - mu[a])² / (2 P[a]))
     + (log(assumed_q × Bsurvey(x)) - log(I) - sigma²/2)² / (2 V)
     - sum(age_count[a] × log(p[a](x)))
```

Only available, included data terms enter the objective. V = max(10^-6, log(1 + index_CV²)); the small floor permits a numerically stable near-exact index at CV = 0. The mean-one lognormal correction uses the actual sigma², including zero when CV = 0. A damped Gauss–Newton iteration (maximum 18 steps, with line search) lowers this objective; its information matrix is the prior precision plus the index and multinomial expected information. The diagonal-plus-two-rank structure allows an O(A) linear solve. Diagnostic exports show before/after objective values and the interface reports iteration count. Iterations are a numerical fit diagnostic, not proof of scientific adequacy.

An approximate conditional Gaussian covariance is the inverse of this information matrix. Delta-method log-SSB variance is g'Cov(x)g, where g[a] is the fitted age's contribution to SSB divided by total fitted SSB. The displayed approximate 80% range is SSB × exp(±1.28155 × sqrt(variance)). This is an assessment range within **one simulated future**, distinct from the 10th–90th percentile bands across MSE futures.

For prediction, posterior diagonal variances follow the surviving cohorts; plus-group variances combine with squared abundance weights. The selected assessment process variance log(1 + process_CV²), with a deliberately flexible default CV of 0.40, is added to surviving ages. New recruitment gets log(1 + recruitment_CV²) plus this process variance. Variances are bounded numerically (10^-7 through 4); inverse-information diagonals have a floor of 10^-8. Cross-age covariance is used in the current SSB range but **discarded between years**. Catch-derived F is treated as fixed during variance propagation. These approximations can understate uncertainty, particularly after long gaps or model misspecification. There is no whole-history smoothing or refit.

q is fixed at its **assumed** value rather than jointly estimated: a relative index and age proportions do not by themselves identify absolute scale. Growth, maturity, selectivities, BH parameters, recruitment CV and unfished SSB are assumed known. M, q, process flexibility and inclusion of ages are editable assessment assumptions. The fit assumes zero survey bias. Its range excludes uncertainty in biological parameters, q, stock structure, ageing error and unreported catch; it is not a validated coverage guarantee.

### Index shortcuts for comparison

“Latest value” and “Last 3 values” convert the relative index to SSB using assumed q and the **unfished** ratio of SSB to survey-selected biomass. They hold their latest estimate between surveys, ignore age samples and catch when estimating the stock, and calculate no uncertainty band. They can therefore be wrong even with zero index noise if the stock's age pattern changes. They are explicitly labelled shortcuts. An ages-only survey requires the age-structured assessment with ages included. Earlier saved `filter` scenarios migrate to `assessment`; older browser settings migrate to the new assessment default while retaining other settings.

### Data-fit plots and exports

The Survey screen plots relative index observations and observed age proportions. The Assessment screen plots estimated SSB against true SSB (truth is a teaching aid only). Optional fit plots compare observed/fitted index and observed/fitted proportions **among survey-selected fish**. Neither index values nor sampled proportions are plotted as tonnes of SSB.

The joint assessment CSV contains historical and future observations, effective age counts, fitted index/proportions, estimated numbers at age, estimated SSB and its approximate range, lagged reported catch and estimated F, fit diagnostics, and the full configuration. True SSB is explicitly marked teaching-only. It describes the first replicate and selected future strategy, not an ensemble mean.

The observation-likelihood choices follow standard fisheries practice described in the [Stock Synthesis manual](https://nmfs-ost.github.io/ss3-doc/SS330_User_Manual_release.html). The separation of population, observation and statistical assessment models is described by [NOAA Fisheries](https://www.fisheries.noaa.gov/feature-story/more-about-fish-stock-assessment-models). Those sources support the concepts; this simplified sequential solver is specific to this classroom lab.

## Reference points and comparison

Equilibrium survivorship and the BH relationship determine abundance at each candidate constant F. Baranov catch gives equilibrium yield. A grid search and numerical refinement maximize that yield to calculate FMSY, MSY and SSBMSY. These deterministic biological reference points do not change merely because the historical F vector changes.

The crossing-risk metric counts projection years 1 through the chosen horizon; it excludes historical years and the projection-start state. Mean catch averages all projection years and futures. Bands are pointwise 10th–90th percentiles across futures, not confidence intervals for the median. Reported FMSY is an illustrative model benchmark, not stock-specific advice.

## Economic postprocessing and stakeholder workshop

Actual catch and F are retained for every future and projection year. `src/economics.js` applies editable accounting assumptions to these trajectories; `src/workshop.js` displays economic outcomes and an objective-scoring workshop. These modules do not alter biology, management advice or fleet behavior. Public survey cost counts visits, including ages-only visits; age-sample size does not add a separate ageing cost in this version. See [the full equations and exercise](ECONOMICS_AND_WORKSHOP.txt). The interface labels landings-supported job-years as a proxy and separates calculated preference scores from participants’ recorded votes.


## Comparing management procedures and objectives (interface 1.8)

An MP combines observations, an assessment method and a harvest rule. Within one lab run, the eight candidate MPs share survey, assessment and implementation settings; their harvest rules differ. This comparison is not a factorial search across different survey/assessment designs. Changing those settings generates a different ensemble; the existing pinned-run feature remains available for a same-rule comparison across runs.

The Compare screen defaults to a radar chart for one to three selected MPs. Its five axes reuse the stakeholder workshop's fixed class targets, rather than rescaling to the currently selected MPs:

| Axis (outward is better) | Score from 0 to 100 | Original value retained |
| --- | --- | --- |
| Avoid low SSB | 100 × (1 − crossing risk) | Fraction of futures crossing the low-SSB limit |
| Catch | 100 × clamp(mean catch / catch target, 0, 1) | Mean actual catch, t/year |
| Fishing profit | 100 × clamp(mean operating profit / profit target, 0, 1) | Mean operating profit, dollars/year |
| Jobs supported | 100 × clamp(mean job-years / jobs target, 0, 1) | Mean landings-supported job-years/year |
| Steady catches | 100 × clamp(1 − mean absolute annual catch change / change-to-avoid, 0, 1) | Mean absolute annual catch change, t |

Risk is the same horizon-specific at-least-one-crossing probability used elsewhere in the lab. The other values average all simulated years and futures. No scoring is applied to a single selected year or the first replicate. Catch, profit and job scores saturate at 100 once their target is reached; negative profit scores zero. Stock safety has its natural probability scale and no editable rescaling. A zero-catch MP can have a high stability score but a low catch/profit score: that is a trade-off, not a scoring error.

Changing class targets changes radar scores and the workshop's criterion scores together. It changes no simulated abundance, observations, HCR decisions, catch or economics. Role weights, votes and shared limits do not change the radar, which presents separate objectives rather than a weighted aggregate. Economic assumptions in People & money update profit and jobs in both views. Jobs are a catch-based proxy and can be correlated with catch. Polygon area is not an overall ranking, and no MP is automatically selected from it. The radar shows summaries, not assessment intervals or uncertainty across futures. Original values and scoring targets are available beside it.

The alternative two-goal view plots all eight MPs using any two distinct objectives: mean catch, mean operating profit, mean jobs, crossing risk or mean absolute annual catch change. Axes use their original units (profit is displayed in thousands of dollars); directions are explained in the caption. Negative profits remain visible. Changing axes never reruns the population model. Interactive points and their text legend choose the MP to inspect in other screens.

Comparison preferences (view, one to three MP IDs and the two axes) are remembered locally and included in scenario JSON. Class targets and economics stay in the existing workshop state. SVG exports retain labels and the selected MP legend; the comparison CSV includes raw values with explicit units, all five scores, targets, economic assumptions and the full model configuration. It reports the selected radar MPs, not a ranking.

Presenting performance against agreed objectives is central to MSE; see [CDFW guidance on comparing performance and evaluating trade-offs](https://wildlife.ca.gov/Conservation/Marine/MLMA/Master-Plan/Mgmt-Strategy-Eval). The chart and scales here are classroom choices rather than management recommendations.
