/**
 * © 2026 Hybrid_by_Ben. All rights reserved. See LICENSE.
 *
 * Feature Requests — Google Form side.
 * The home page (site/index.html) submits to this form. Requests stay in the
 * form's responses in Ben's Google account (nothing goes to GitHub, since the
 * repos are public). Each request also sends Ben a notification on his private
 * admin ntfy topic: tool, idea and name, but never the email address, which
 * stays in Google only.
 *
 * Script properties (Project Settings > Script properties):
 *   NTFY_ADMIN_TOPIC  Ben's private ntfy topic
 */
const FIELDS = ['Tool', 'Idea', 'Name', 'Email'];
const TOOLS = ['BASELINE Tracking', 'Ticket Watch', 'Race Analysis', 'A new tool', 'General'];

/** Run once from the editor: creates the form and its submit trigger, and prints the page config. */
function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));   // safe to re-run

  const form = FormApp.create('Hybrid_by_Ben — feature requests');
  form.setDescription('Used by hybridbyben.com. Please send requests from the home page instead.');
  form.setConfirmationMessage('Thanks! Ben reads every request.');
  form.setCollectEmail(false);
  // Plain text questions, so the home page can submit to this form directly.
  form.addTextItem().setTitle('Tool').setRequired(true).setHelpText(TOOLS.join(', '));
  form.addParagraphTextItem().setTitle('Idea').setRequired(true);
  form.addTextItem().setTitle('Name').setHelpText('Optional');
  form.addTextItem().setTitle('Email').setHelpText('Optional, for a reply. Never shown on the site.');

  ScriptApp.newTrigger('onSubmit').forForm(form).onFormSubmit().create();
  PropertiesService.getScriptProperties().setProperty('FORM_ID', form.getId());
  printConfig();
}

/** Prints the block to paste into site/config.js. */
function printConfig() {
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_ID'));
  let resp = form.createResponse();
  form.getItems().forEach((it, i) => {
    const item = it.getType() === FormApp.ItemType.PARAGRAPH_TEXT ? it.asParagraphTextItem() : it.asTextItem();
    resp = resp.withItemResponse(item.createResponse('x' + i));
  });
  const ids = {};
  resp.toPrefilledUrl().replace(/entry\.(\d+)=x(\d)/g, (_, id, i) => { ids[i] = 'entry.' + id; });
  const cfg = {
    FORM_ACTION: form.getPublishedUrl().replace(/\/viewform.*$/, '/formResponse'),
    ENTRY: { tool: ids[0], idea: ids[1], name: ids[2], email: ids[3] },
  };
  Logger.log('Paste this into site/config.js:\n\nwindow.FEATURE_REQUESTS = ' + JSON.stringify(cfg, null, 2) + ';');
  Logger.log('Responses: ' + form.getEditUrl() + ' (Responses tab; "Link to Sheets" for a spreadsheet)');
}

function onSubmit(e) {
  const a = {};
  e.response.getItemResponses().forEach(r => { a[r.getItem().getTitle()] = String(r.getResponse()).trim(); });
  const idea = (a.Idea || '').slice(0, 2000);
  if (!idea) return;
  const tool = TOOLS.indexOf(a.Tool) >= 0 ? a.Tool : 'General';
  const name = (a.Name || '').replace(/[^\p{L}\s.'-]/gu, '').trim().slice(0, 30);
  notify_({
    title: `Feature request: ${tool}`,
    body: `${idea.length > 400 ? idea.slice(0, 400) + '…' : idea}\n— ${name || 'no name'}${a.Email ? ' (left an email: see the form responses)' : ''}`,
    priority: 'default',
  });
}

// ntfy headers must be plain ASCII. ntfy.sh limits requests per internet
// address, and Apps Script shares addresses with other people's scripts, so a
// 429 can happen for no fault of ours: wait and retry, up to 3 tries.
function notify_(n) {
  const topic = PropertiesService.getScriptProperties().getProperty('NTFY_ADMIN_TOPIC');
  if (!topic) return console.warn('No NTFY_ADMIN_TOPIC set; skipped: ' + n.title);
  const ascii = s => String(s).replace(/[’‘]/g, "'").replace(/[^\x20-\x7E]/g, '?');
  const headers = { Title: ascii(n.title), Priority: n.priority || 'default' };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = UrlFetchApp.fetch('https://ntfy.sh/' + topic, { method: 'post', payload: n.body, headers, muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code === 200) return true;
    console.warn(`ntfy responded ${code} (try ${attempt} of 3): ${n.title}`);
    if (code !== 429 && code < 500) return false;
    if (attempt < 3) Utilities.sleep(10000 * attempt);
  }
  return false;
}
