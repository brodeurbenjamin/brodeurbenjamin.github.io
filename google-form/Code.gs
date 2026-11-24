/**
 * © 2026 Hybrid_by_Ben. All rights reserved. See LICENSE.
 *
 * Feature Requests — Google Form side.
 * The home page (site/index.html) submits to this form. Requests stay in the
 * form's responses in Ben's Google account (nothing goes to GitHub, since the
 * repos are public), and each one is emailed to support@hybridbyben.com. When
 * the requester leaves an email address it's set as Reply-To, so Ben can just
 * reply.
 *
 * Script properties (Project Settings > Script properties), optional:
 *   SUPPORT_EMAIL  where requests go (default support@hybridbyben.com)
 */
const FIELDS = ['Tool', 'Idea', 'Name', 'Email'];
const TOOLS = ['BASELINE Tracking', 'Ticket Watch', 'Race Analysis', 'A new tool', 'General'];
const DEFAULT_TO = 'support@hybridbyben.com';

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
  const idea = (a.Idea || '').slice(0, 5000);
  if (!idea) return;
  const tool = TOOLS.indexOf(a.Tool) >= 0 ? a.Tool : 'General';
  const name = (a.Name || '').replace(/[^\p{L}\s.'-]/gu, '').trim().slice(0, 30);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.Email || '') ? a.Email.slice(0, 100) : '';
  const to = PropertiesService.getScriptProperties().getProperty('SUPPORT_EMAIL') || DEFAULT_TO;
  const options = { name: 'Hybrid_by_Ben feature requests' };
  if (email) options.replyTo = email;   // just hit Reply to answer them
  MailApp.sendEmail(to, `Feature request: ${tool}${name ? ` (${name})` : ''}`,
    `${idea}\n\n` +
    `Tool: ${tool}\n` +
    `From: ${name || 'no name given'}\n` +
    `Reply to: ${email || 'no email given'}\n` +
    `Sent: ${Utilities.formatDate(new Date(), 'America/Toronto', 'EEE d MMM yyyy, h:mm a')} Eastern\n\n` +
    `All requests are also in the form's Responses tab.`, options);
}
