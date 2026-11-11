/* Avis des pages œuvres : lecture des avis publiés et formulaire d'envoi.
   Les avis arrivent dans le tableur Google de Philippe ; ils s'affichent ici une fois la case « Publier » cochée.
   Les mêmes avis apparaissent sur la page française et sur la page anglaise de l'œuvre. */
(function () {
  'use strict';

  var ENDPOINT = '__ENDPOINT__';
  var VISIBLES = 5; // avis affichés avant « Voir tous les avis »

  var section = document.getElementById('avis');
  if (!section || ENDPOINT.indexOf('__') === 0) return;

  var LANG = document.documentElement.lang === 'en' ? 'en' : 'fr';
  var LOCALE = LANG === 'en' ? 'en-GB' : 'fr-FR';
  var T = {
    fr: {
      titre: 'Avis',
      aucun: 'Aucun avis pour l’instant. Soyez le premier à dire ce que cette photographie vous inspire.',
      compte: function (n) { return n + ' avis'; },
      tous: function (n) { return 'Voir les ' + n + ' avis'; },
      reponse: 'Réponse du photographe',
      surCinq: function (n) { return n + ' sur 5'; },
      etoile: function (n) { return n + (n > 1 ? ' étoiles' : ' étoile') + ' sur 5'; },
      formTitre: 'Donner mon avis',
      formIntro: 'Que vous ayez acheté un tirage ou non, dites ce que cette photographie vous inspire.',
      note: 'Votre note',
      prenom: 'Prénom',
      texte: 'Votre avis',
      envoyer: 'Envoyer mon avis',
      envoi: 'Envoi…',
      prive: 'Seuls votre prénom, votre note et votre avis seront affichés. Aucune adresse e-mail n’est demandée.',
      merciTitre: 'Merci !',
      merci: 'Votre avis a bien été reçu. Il apparaîtra ici après relecture.',
      erreurs: {
        note: 'Choisissez une note de 1 à 5 étoiles.',
        champs: 'Indiquez votre prénom et quelques mots sur la photographie.',
        lien: 'Les liens et adresses de sites ne sont pas acceptés dans les avis.',
        trop: 'Beaucoup d’avis reçus en peu de temps : réessayez dans quelques minutes.',
        defaut: 'L’envoi n’a pas abouti. Réessayez dans un instant.'
      },
      legal: 'Avis non vérifiés : ils peuvent être laissés par des acheteurs comme par de simples visiteurs, sans aucune contrepartie. Chaque avis est relu avant publication pour écarter les contenus injurieux, hors sujet ou publicitaires ; un avis n’est jamais écarté parce qu’il est négatif. Classement du plus récent au plus ancien.',
      legalLien: 'En savoir plus',
      legalUrl: 'mentions-legales.html#avis'
    },
    en: {
      titre: 'Reviews',
      aucun: 'No reviews yet. Be the first to share what this photograph means to you.',
      compte: function (n) { return n + (n > 1 ? ' reviews' : ' review'); },
      tous: function (n) { return 'Show all ' + n + ' reviews'; },
      reponse: 'Photographer’s reply',
      surCinq: function (n) { return n + ' out of 5'; },
      etoile: function (n) { return n + (n > 1 ? ' stars' : ' star') + ' out of 5'; },
      formTitre: 'Leave a review',
      formIntro: 'Whether or not you have bought a print, tell us what this photograph means to you.',
      note: 'Your rating',
      prenom: 'First name',
      texte: 'Your review',
      envoyer: 'Send my review',
      envoi: 'Sending…',
      prive: 'Only your first name, rating and review will be shown. No email address is required.',
      merciTitre: 'Thank you!',
      merci: 'Your review has been received. It will appear here once it has been read.',
      erreurs: {
        note: 'Please choose a rating from 1 to 5 stars.',
        champs: 'Please enter your first name and a few words about the photograph.',
        lien: 'Links and website addresses are not accepted in reviews.',
        trop: 'Many reviews received in a short time: please try again in a few minutes.',
        defaut: 'Your review could not be sent. Please try again in a moment.'
      },
      legal: 'Unverified reviews: they may be left by buyers or by visitors, with no incentive of any kind. Each review is read before publication to filter out abusive, off-topic or promotional content; a review is never rejected for being negative. Sorted from newest to oldest.',
      legalLien: 'Learn more',
      legalUrl: 'legal-notice.html#reviews'
    }
  }[LANG];

  /* Identifiant de l'œuvre, commun aux pages FR et EN : « serie/oeuvre » */
  var canon = document.querySelector('link[rel="canonical"]');
  var chemin = new URL(canon ? canon.href : location.href).pathname;
  var CLE = chemin.replace(/^\/(en\/)?/, '').replace(/\.html$/, '');
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(CLE)) return;
  var h1 = document.querySelector('h1');
  var TITRE = h1 ? h1.textContent.trim() : CLE;
  var RACINE = '../'; // les pages œuvres sont un niveau sous la racine de leur langue

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var ETOILE = 'M12 2.6l2.83 6.05 6.62.78-4.9 4.52 1.3 6.55L12 17.2l-5.85 3.3 1.3-6.55-4.9-4.52 6.62-.78z';

  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (enfants || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* etat : 1 = pleine, 0.5 = demi-étoile, 0 = vide */
  function etoile(etat) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    if (etat === 1) s.setAttribute('class', 'on');
    var p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', ETOILE);
    s.appendChild(p);
    if (etat === 0.5) {
      s.setAttribute('class', 'half');
      var moitie = document.createElementNS(SVG_NS, 'path');
      moitie.setAttribute('d', ETOILE);
      moitie.setAttribute('class', 'fill');
      moitie.setAttribute('clip-path', 'url(#avis-moitie)');
      s.appendChild(moitie);
    }
    return s;
  }

  function etoiles(note, label) {
    var span = el('span', { class: 'stars', role: 'img', 'aria-label': label });
    for (var i = 1; i <= 5; i++) {
      span.appendChild(etoile(note >= i - 0.25 ? 1 : note >= i - 0.75 ? 0.5 : 0));
    }
    return span;
  }

  /* Gabarit de découpe partagé par les demi-étoiles */
  function defsDemiEtoile() {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('width', '0');
    s.setAttribute('height', '0');
    s.setAttribute('aria-hidden', 'true');
    s.style.position = 'absolute';
    s.innerHTML = '<defs><clipPath id="avis-moitie" clipPathUnits="objectBoundingBox"><rect width="0.5" height="1"/></clipPath></defs>';
    return s;
  }

  function dateLisible(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00');
    return isNaN(d) ? '' : d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function moyenne(liste) {
    var s = 0;
    liste.forEach(function (a) { s += a.r; });
    return Math.round((s / liste.length) * 10) / 10;
  }

  /* ---------- Squelette de la section ---------- */

  var resume = el('p', { class: 'avis-score' });
  var liste = el('ol', { class: 'avis-list', 'aria-live': 'polite' });
  var plus = el('button', { type: 'button', class: 'btn btn--ghost avis-plus', hidden: '' });
  var colonneAvis = el('div', { class: 'avis-col' }, [resume, liste, plus]);
  var formulaire = construitFormulaire();
  var lienLegal = el('a', { href: RACINE + T.legalUrl, text: T.legalLien });
  var legal = el('p', { class: 'avis-legal' }, [document.createTextNode(T.legal + ' '), lienLegal]);

  section.appendChild(defsDemiEtoile());
  section.appendChild(el('div', { class: 'avis-head' }, [el('h2', { id: 'h-avis', text: T.titre })]));
  section.appendChild(el('div', { class: 'avis-grid' }, [colonneAvis, formulaire]));
  section.appendChild(legal);
  section.hidden = false;
  resume.textContent = ' ';

  /* ---------- Affichage des avis publiés ---------- */

  function rendAvis(tous) {
    liste.textContent = '';
    resume.textContent = '';
    if (!tous.length) {
      resume.className = 'avis-score avis-score--vide';
      resume.textContent = T.aucun;
      return;
    }
    var m = moyenne(tous);
    var mLisible = m.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    resume.className = 'avis-score';
    resume.appendChild(etoiles(m, T.surCinq(mLisible)));
    resume.appendChild(el('b', { text: mLisible }));
    resume.appendChild(el('span', { text: T.compte(tous.length) }));

    tous.forEach(function (a, i) {
      var meta = el('div', { class: 'avis-meta' }, [
        etoiles(a.r, T.etoile(a.r)),
        el('b', { text: a.n }),
        a.d ? el('time', { datetime: a.d, text: dateLisible(a.d) }) : null
      ]);
      var texte = el('p', { class: 'avis-texte', text: a.t });
      if (a.l !== LANG) texte.setAttribute('lang', a.l);
      var item = el('li', { class: 'avis-item' }, [meta, texte]);
      if (a.rep) {
        item.appendChild(el('div', { class: 'avis-rep' }, [
          el('b', { text: T.reponse }),
          el('p', { text: a.rep })
        ]));
      }
      if (i >= VISIBLES) item.hidden = true;
      liste.appendChild(item);
    });

    if (tous.length > VISIBLES) {
      plus.textContent = T.tous(tous.length);
      plus.hidden = false;
      plus.onclick = function () {
        Array.prototype.forEach.call(liste.children, function (li) { li.hidden = false; });
        plus.hidden = true;
      };
    }

    ajouteResumeCommande(m, mLisible, tous.length);
    ajouteDonneesStructurees(tous, m);
  }

  /* Note moyenne rappelée dans l'encadré « Commander un tirage » */
  function ajouteResumeCommande(m, mLisible, n) {
    var aside = document.querySelector('.order');
    if (!aside || aside.querySelector('.order-avis')) return;
    var lien = el('a', { class: 'order-avis', href: '#avis' }, [
      etoiles(m, T.surCinq(mLisible)),
      el('span', { text: mLisible + ' · ' + T.compte(n) })
    ]);
    var h2 = aside.querySelector('h2');
    if (h2 && h2.nextSibling) aside.insertBefore(lien, h2.nextSibling);
    else aside.appendChild(lien);
  }

  /* Note et avis ajoutés aux données Product de la page (étoiles possibles dans les résultats Google) */
  function ajouteDonneesStructurees(tous, m) {
    var ld = document.querySelector('script[data-ld="product"]');
    if (!ld) return;
    try {
      var data = JSON.parse(ld.textContent);
      data.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: m,
        reviewCount: tous.length,
        bestRating: 5,
        worstRating: 1
      };
      data.review = tous.slice(0, 10).map(function (a) {
        return {
          '@type': 'Review',
          author: { '@type': 'Person', name: a.n },
          datePublished: a.d,
          reviewBody: a.t,
          inLanguage: a.l,
          reviewRating: { '@type': 'Rating', ratingValue: a.r, bestRating: 5, worstRating: 1 }
        };
      });
      ld.textContent = JSON.stringify(data);
    } catch (e) { /* données structurées laissées telles quelles */ }
  }

  function chargeAvis() {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var minuterie = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    fetch(ENDPOINT + '?k=' + encodeURIComponent(CLE), ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (d) { rendAvis(d && d.ok && Array.isArray(d.avis) ? d.avis : []); })
      .catch(function () { rendAvis([]); })
      .then(function () { if (minuterie) clearTimeout(minuterie); });
  }

  /* ---------- Formulaire ---------- */

  function construitFormulaire() {
    var form = el('form', { class: 'avis-form', novalidate: '' });
    var debut = Date.now();
    var noteChoisie = 0;

    var groupe = el('div', { class: 'rate', role: 'radiogroup', 'aria-labelledby': 'avis-note-l' });
    var labels = [];
    for (var i = 1; i <= 5; i++) {
      (function (v) {
        var input = el('input', { type: 'radio', name: 'note', id: 'avis-note-' + v, value: String(v) });
        var label = el('label', { for: 'avis-note-' + v, title: T.etoile(v) }, [etoile(false), el('span', { class: 'sr-only', text: T.etoile(v) })]);
        input.addEventListener('change', function () { noteChoisie = v; peint(v); });
        label.addEventListener('mouseenter', function () { peint(v); });
        groupe.appendChild(input);
        groupe.appendChild(label);
        labels.push(label);
      })(i);
    }
    groupe.addEventListener('mouseleave', function () { peint(noteChoisie); });
    function peint(v) {
      labels.forEach(function (l, i) { l.querySelector('svg').setAttribute('class', i < v ? 'on' : ''); });
    }

    var prenom = el('input', { type: 'text', id: 'avis-prenom', name: 'prenom', maxlength: '40', autocomplete: 'given-name', required: '' });
    var texte = el('textarea', { id: 'avis-texte', name: 'texte', rows: '4', maxlength: '1200', required: '' });
    var piege = el('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' });
    var message = el('p', { class: 'avis-msg', role: 'alert', hidden: '' });
    var bouton = el('button', { class: 'btn', type: 'submit', text: T.envoyer });

    form.appendChild(el('h3', { text: T.formTitre }));
    form.appendChild(el('p', { class: 'avis-intro', text: T.formIntro }));
    form.appendChild(el('fieldset', null, [el('legend', { id: 'avis-note-l', text: T.note }), groupe]));
    form.appendChild(el('div', { class: 'champ' }, [el('label', { for: 'avis-prenom', text: T.prenom }), prenom]));
    form.appendChild(el('div', { class: 'champ' }, [el('label', { for: 'avis-texte', text: T.texte }), texte]));
    form.appendChild(el('div', { class: 'piege', 'aria-hidden': 'true' }, [el('label', { text: 'Website' }), piege]));
    form.appendChild(message);
    form.appendChild(bouton);
    form.appendChild(el('p', { class: 'avis-prive', text: T.prive }));

    function erreur(cle) {
      message.textContent = T.erreurs[cle] || T.erreurs.defaut;
      message.hidden = false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      message.hidden = true;
      if (!noteChoisie) return erreur('note');
      if (!prenom.value.trim() || texte.value.trim().length < 3) return erreur('champs');
      if (/https?:\/\/|www\./i.test(texte.value + ' ' + prenom.value)) return erreur('lien');

      bouton.disabled = true;
      bouton.textContent = T.envoi;
      fetch(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({
          k: CLE, titre: TITRE, l: LANG, r: noteChoisie,
          n: prenom.value.trim(), t: texte.value.trim(),
          website: piege.value, elapsed: Date.now() - debut
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) throw new Error(d && d.erreur);
          form.textContent = '';
          form.classList.add('is-sent');
          form.appendChild(el('h3', { text: T.merciTitre }));
          form.appendChild(el('p', { class: 'avis-intro', text: T.merci }));
        })
        .catch(function (err) {
          erreur(err && err.message);
          bouton.disabled = false;
          bouton.textContent = T.envoyer;
        });
    });

    return form;
  }

  chargeAvis();
})();
