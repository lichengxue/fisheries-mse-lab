/* A short teaching path, with optional detail kept close to each task. */
(function(){
'use strict';
const $=id=>document.getElementById(id),api=globalThis.__mseDemo,V=globalThis.MSEViews;
const one=s=>document.querySelector(s),all=s=>Array.from(document.querySelectorAll(s));
function text(selector,value){const el=one(selector);if(el)el.textContent=value;}
function fold(nodes,title,id){nodes=nodes.filter(Boolean);if(!nodes.length)return;const d=document.createElement('details'),summary=document.createElement('summary');d.className='learn-more';if(id)d.id=id;summary.textContent=title;d.append(summary);nodes[0].before(d);nodes.forEach(n=>d.append(n));return d;}
function field(id,label){const input=$(id),wrapper=input?.closest('label'),span=wrapper?.querySelector('span');if(!span)return;const output=span.querySelector('output');span.textContent=label+' ';if(output)span.append(output);input.setAttribute('aria-label',label);const companion=wrapper.querySelector('[data-companion]');if(companion)companion.setAttribute('aria-label',label+' value');}
function intro(id,title,description){text('#view-'+id+' .view-intro h2',title);text('#view-'+id+' .view-intro h2+p',description);}
function caption(id,value){const figure=$(id).closest('figure'),old=figure.querySelector('figcaption');if(old)old.hidden=true;const p=document.createElement('p');p.className='caption';p.textContent=value;figure.append(p);}
function next(id,label,target){const row=document.createElement('div'),b=document.createElement('button');row.className='lesson-next';b.className='btn primary';b.type='button';b.textContent=label+' →';b.addEventListener('click',()=>V.showView(target));row.append(b);$('view-'+id).append(row);}
for(const [id,label]of Object.entries({stock:'Fish stock',data:'Survey',rules:'Fishing rules',results:'Compare',future:'One future',people:'People & money'})){const b=$('tab-'+id),number=b.querySelector('span');b.replaceChildren(number,document.createTextNode(label));}
text('.mast h1','Fisheries MSE lab');text('.mast>div>p:last-child','Test fishing rules in a simulated fishery. This is management strategy evaluation (MSE).');
all('.view-badge,.view-intro .eyebrow').forEach(el=>el.hidden=true);
intro('stock','How does fishing change a fish stock?','Choose a fish and a fishing history. Drag a bar to change fishing pressure and watch the stock respond.');
intro('data','How well can we measure the stock?','Make the survey more or less noisy. Compare the estimate with the true breeding stock.');
intro('rules','How should fishing respond?','Choose a rule above. Adjust its settings and see how it responds when the stock changes.');
intro('results','Which rule gives the best balance?','Compare catch with the chance of the stock becoming too low. Click a dot to choose a rule.');
intro('future','What happens year by year?','Press Play years to follow one possible future: survey, estimate, decide and catch.');
intro('people','Who benefits, and what matters?','Explore income and jobs. Then discuss the trade-offs with different groups.');
text('[data-control-panel=stock] .control-heading','Choose your fish');
text('[data-control-panel=data] .control-heading','Measure the stock');
text('[data-control-panel=rules] .control-heading','Adjust the fishing rule');
text('[data-control-panel=results] .control-heading','Run the experiment');
text('[data-control-panel=people] .control-heading','People & money');
all('.control-panel fieldset>legend').forEach(el=>el.hidden=true);
all('.control-panel .help').forEach(el=>el.hidden=true);
for(const id of ['life-profile','estimator-note'])$(id).hidden=false;
field('historyPreset','Fishing history');field('surveyCV','Survey noise (%)');field('surveyBias','Survey over- or under-estimate (%)');field('surveyEvery','How often do we survey?');field('estimator','How do we estimate the stock?');
field('steepness','How strongly young fish can replenish the stock (h)');field('recruitCV','Year-to-year variation in young fish (%)');
field('Fmultiplier','Fishing target (× FMSY)');field('harvest','Share of estimated breeding fish to catch (%)');
field('limit','Stop fishing below this stock level (%)');field('trigger','Allow full fishing above this stock level (%)');field('smoothCap','Maximum yearly catch change (%)');field('implementationCV','Variation in following catch advice (%)');
field('years','Years to look ahead');field('reps','Number of possible futures');field('seed','Repeatable random seed');
field('Mfactor','Assumed natural death rate (× true rate)');
fold([$('steepness').closest('label'),$('recruitCV').closest('label')],'More about young fish');
text('[data-control-panel=stock] details:has(#historicalF)>summary','Paste your own fishing history');
fold([$('surveyBias').closest('label'),$('Mfactor-wrap')],'More survey and model settings');
text('#estimator option[value=direct]','Use the latest survey');text('#estimator option[value=mean]','Average the last 3 surveys');text('#estimator option[value=filter]','Follow fish ages through time');
const presets=all('[data-set=surveyCV]');['No noise','Some noise','Very noisy'].forEach((t,i)=>{if(presets[i])presets[i].textContent=t;});
text('#historyPreset option[value=constant]','Steady fishing');text('#historyPreset option[value=custom]','My own history');text('#historyPreset option[value=unfished]','No fishing');
const builderMore=fold([one('.history-builder')],'Build a fishing history');one('.history-plots').after(builderMore);
fold([one('.editor-detail'),one('.history-tools'),$('year-grid').closest('details')],'Type values or import a file');
$('history-editor').after($('undo-history'));
fold([$('history-csv')],'Download the history');
fold([$('recruitment-chart').closest('.plots')],'How do adult fish produce young fish?');
text('.history-plots figure h3','Fishing pressure (F)');text('.history-plots figure:nth-of-type(2) h3','How the stock responds');
caption('history-ssb-chart','This is the weight of mature fish that can produce young. How does it change when fishing pressure rises or falls?');
const surveyMore=document.createElement('details'),surveySummary=document.createElement('summary'),surveyLabel=document.createElement('label'),surveyCheck=document.createElement('input');surveyMore.className='learn-more';surveySummary.textContent='Add survey information';surveyLabel.className='soc-check';surveyCheck.type='checkbox';surveyCheck.id='show-history-observations';surveyLabel.append(surveyCheck,document.createTextNode('Show surveys and estimates'));surveyMore.append(surveySummary,surveyLabel);$('history-ssb-chart').closest('figure').append(surveyMore);surveyCheck.addEventListener('change',()=>api.refresh());
text('.history-plots .legend>span:first-child','True breeding fish');text('#inspect-bar>label','Fishing rule');
const trueKey=one('.history-plots .legend>span:first-child'),sample=document.createElement('i');sample.className='sample';sample.style.background='var(--teal)';trueKey.prepend(sample);
all('.legend span').forEach(el=>Array.from(el.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.textContent=n.textContent.replace('True SSB','True breeding fish').replace('Estimated SSB','Estimate')));
fold([$('survey-demo').closest('figure')],'See repeated surveys of the same stock');
text('#view-data .mini-flow','Survey → Estimate → Fishing decision');
$('observation-chart').closest('figure').querySelector('h3').textContent='The true stock and what the manager sees';
$('observation-chart').closest('figure').classList.add('full');one('#view-data .plots').prepend($('observation-chart').closest('figure'));
caption('observation-chart','Gray: true breeding fish. Dots: surveys. Colored line: the estimate used for fishing decisions.');
const catchBox=one('.catch-levels'),fBox=document.createElement('div'),uBox=document.createElement('div');
fBox.className='rule-options';fBox.dataset.forRules='fmsy framp';$('Fmultiplier').closest('label').before(fBox);fBox.append($('Fmultiplier').closest('label'));
const shortcuts=all('[data-set=Fmultiplier]')[0]?.parentElement;if(shortcuts)fold([shortcuts],'Try another fishing target');
uBox.className='rule-options';uBox.dataset.forRules='proportional ramp smooth';$('harvest').closest('label').before(uBox);uBox.append($('harvest').closest('label'));
catchBox.classList.add('rule-options');catchBox.dataset.forRules='catchLow fixed catchHigh';
const moreCatch=fold([$('msy-catches').parentElement],'Set catch levels using MSY');moreCatch.classList.add('rule-options');moreCatch.dataset.forRules='catchLow fixed catchHigh';
text('[data-control-panel=rules] details:has(#limit)>summary','More fishing-rule settings');
const ruleHelp=document.createElement('p');ruleHelp.id='plain-rule-help';ruleHelp.className='lesson-help';$('hcr-chart').closest('figure').before(ruleHelp);
fold([$('reference-values'),$('reference-note'),$('yield-chart').closest('figure')],'What do FMSY and MSY mean?','reference-explainer');
const referenceIntro=document.createElement('p');referenceIntro.className='lesson-help';referenceIntro.textContent='FMSY is the model’s fishing-rate target for the largest long-term catch. MSY is that catch in tonnes. These targets do not guarantee a safe outcome.';$('reference-values').before(referenceIntro);
caption('hcr-chart','The line shows the rule. The dot shows one year’s estimate and fishing decision.');
fold([one('#view-results .results:has(#strategy-toggles)')],'How do the rules compare over time?');
fold([$('comparison').closest('section')],'See the numbers for every rule');
fold([one('#view-results .result-actions')],'Download results or save a comparison');
const design=one('[data-control-panel=results]');fold(Array.from(design.children).filter(el=>!el.classList.contains('control-heading')),'Change the experiment settings');
const designHelp=document.createElement('p');designHelp.className='lesson-help';designHelp.textContent='The same stock and random conditions are used for every rule, so the comparison is fair.';design.prepend(designHelp);
text('#view-results .figure h3','Catch versus the chance of a low stock');
caption('tradeoff-chart','Right means more catch. Lower means fewer futures with very low stock. There may be no single best rule.');
const futureExtra=[$('age-chart').closest('figure'),$('f-chart').closest('figure')];fold(futureExtra,'Look at fish ages and fishing pressure');
$('biomass-chart').closest('figure').querySelector('h3').textContent='How the breeding stock changes';$('catch-chart').closest('figure').querySelector('h3').textContent='How catch changes';
caption('biomass-chart','The colored line is the middle outcome. The shaded band contains 8 in 10 simulated outcomes. The thin line follows one future.');
caption('catch-chart','Catch is what is actually taken, which can differ from the advice. The shaded band contains 8 in 10 simulated outcomes.');
all('#view-future .legend').forEach(legend=>legend.hidden=true);
text('#trace-title','One year in the fishery');text('#view-future .trace-head .subtle','The manager sees surveys and catch reports. You can also see the true stock.');
all('[data-control-panel=future] .neutral-note').forEach(el=>el.hidden=true);
const econ=$('economic-settings');text('#economic-settings>p','Try changing price, costs or the share of catch going to small vessels.');
text('#workshop-settings>p','Choose a group card, then set what matters to that group.');
const shared=$('guardrail-controls').closest('details');shared.open=false;text('#workshop-settings>details>summary','Shared limits');

text('#view-people .people-note','Try a question: does the rule with the most catch also earn the most?');
text('[data-people-mode=economics]','Income & jobs');text('[data-people-mode=workshop]','Stakeholder discussion');
fold([$('profit-chart').closest('figure')],'How does profit change over time?');
fold([$('economic-ledger').closest('section')],'Compare all economic results');
fold([$('stress-table').closest('section')],'What if costs rise or prices fall?');

text('#economics-panel .figure:has(#value-frontier) h3','Profit versus the chance of a low stock');
$('value-frontier').closest('figure').classList.add('full');one('#economics-panel .plots').prepend($('value-frontier').closest('figure'));
caption('value-frontier','Each dot is a fishing rule. Right means more profit; lower means less risk. Larger dots support more jobs under your assumptions.');
const matrix=$('score-table').closest('section');fold([matrix],'Compare scores for all fishing rules');
fold([$('criteria-bars').closest('section')],'How are the scores worked out?');
fold([$('ballots').closest('section')],'Record votes and save a class decision');
fold([$('recorded-rounds').closest('section')],'Review saved discussion rounds');
const matches=document.createElement('section');matches.className='people-panel';matches.id='role-matches';$('workshop-summary').after(matches);
text('#workshop-panel>.people-note','Choose a group and set its priorities. Then compare scores and discuss a class decision. These are classroom roles, not real stakeholder opinions.');
all('#workshop-panel>.people-note').slice(1).forEach(el=>el.hidden=true);
const roleTools=$('add-role').parentElement;fold([roleTools],'Add, rename or remove groups');
text('#workshop-settings details:has(#target-controls)>summary','Change what counts as a good outcome');
$('refresh-ballots').hidden=true;
all('#workshop-panel>p.footnote').forEach(el=>fold([el],'Further reading'));
const glossary=document.createElement('section');glossary.className='full-width';glossary.innerHTML='<h3>A few useful terms</h3><p><strong>Stock:</strong> a population of fish. <strong>Breeding fish (SSB):</strong> the weight of mature fish. <strong>Unfished level:</strong> the stock level with no fishing. <strong>Fishing pressure (F):</strong> a rate describing how strongly fishing removes fish.</p><p><strong>Recruitment:</strong> young fish entering the population. This model uses the Beverton–Holt relationship. <strong>Survey noise (CV):</strong> variation in repeated measurements. <strong>Risk:</strong> the share of simulated futures where the breeding stock falls below the chosen limit at least once.</p><p><strong>Middle outcome (median):</strong> half the outcomes fall above and half below it. The shaded range runs from the 10th to the 90th percentile.</p>';
one('#model-details .details-grid').prepend(glossary);text('#model-details>summary','Learn more: terms, assumptions & equations');
next('stock','Next: measure the stock','data');next('data','Next: choose a fishing rule','rules');next('rules','Next: compare outcomes','results');
const questions=fold([one('.scenario-bar')],'Try another classroom question');one('#view-stock .lesson-next').before(questions);
all('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)requestAnimationFrame(()=>api.refresh());}));
function update(){
 const selected=api.selected,c=api.result?.config;
 all('.rule-options').forEach(el=>el.hidden=!el.dataset.forRules.split(' ').includes(selected));
 const description={catchLow:'Asks for a fixed catch each year, even when the stock changes.',fixed:'Asks for a fixed catch each year, even when the stock changes.',catchHigh:'Asks for a fixed catch each year, even when the stock changes.',proportional:'Asks for a fixed share of the estimated breeding stock.',ramp:'Reduces catch as the stock falls, and stops fishing below the limit.',smooth:'Responds to the stock while limiting sudden changes in catch. A closure can override that limit.',fmsy:'Uses the model’s FMSY fishing target each year.',framp:'Uses the FMSY target when the stock is healthy, then reduces fishing as the stock falls.'};
 $('plain-rule-help').textContent=description[selected];$('selected-context').textContent=['fmsy','framp'].includes(selected)?'FMSY = the model’s target fishing rate.':'';
 const observed=$('show-history-observations').checked;all('.history-plots figure:last-child .legend>span').forEach((el,i)=>el.hidden=i>0&&!observed);
 const view=one('.view-panel:not([hidden])')?.id;one('.scenario-bar').hidden=view!=='view-stock';

}
// Refresh the relevant controls when the student chooses another rule.
document.addEventListener('mse:render',update);document.addEventListener('mse:workshop',update);
update();api.refresh();
})();
