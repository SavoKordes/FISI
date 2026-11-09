/** Projekt-Checkliste (FISI, AO 2020). Vorgaben der eigenen IHK haben Vorrang. */
export type ChecklistGroup = { id: string; title: string; items: { id: string; text: string; hint?: string }[] };

export const CHECKLIST: ChecklistGroup[] = [
  {
    id: 'antrag',
    title: 'Projektantrag',
    items: [
      { id: 'antrag-thema', text: 'Thema mit Ausbilder abgestimmt – echter betrieblicher Auftrag mit Kundenbezug', hint: 'Fachrichtungstypisch (Systemintegration), mit eigener Planungs- und Entscheidungsleistung' },
      { id: 'antrag-ist', text: 'Ausgangssituation (Ist-Zustand) und Problem klar beschrieben' },
      { id: 'antrag-ziel', text: 'Projektziele (Sach-, Zeit-, Kostenziel) SMART formuliert' },
      { id: 'antrag-abgrenzung', text: 'Projektumfeld, Schnittstellen und Abgrenzung (was gehört nicht dazu) genannt' },
      { id: 'antrag-zeit', text: 'Zeitplanung mit Phasen und Stunden (Summe 40 h) inkl. Analyse, Tests und Dokumentation' },
      { id: 'antrag-frist', text: 'Antrag fristgerecht im IHK-Portal eingereicht und Genehmigung erhalten' },
    ],
  },
  {
    id: 'durchfuehrung',
    title: 'Durchführung',
    items: [
      { id: 'dur-tagebuch', text: 'Projekttagebuch/Stundennachweis laufend geführt' },
      { id: 'dur-alternativen', text: 'Alternativen recherchiert und Entscheidung begründet (z. B. Nutzwertanalyse)' },
      { id: 'dur-kosten', text: 'Kostenkalkulation und Wirtschaftlichkeit (z. B. Amortisation) erstellt' },
      { id: 'dur-screens', text: 'Screenshots, Konfigurationsauszüge und Netzpläne während der Umsetzung gesichert (ohne Kennwörter)' },
      { id: 'dur-tests', text: 'Tests geplant, durchgeführt und protokolliert' },
      { id: 'dur-abnahme', text: 'Abnahme durch Auftraggeber dokumentiert (Abnahmeprotokoll)' },
    ],
  },
  {
    id: 'gliederung',
    title: 'Dokumentation – Gliederung',
    items: [
      { id: 'gl-einleitung', text: 'Einleitung: Projektumfeld, Ausgangssituation, Ziel, Abgrenzung' },
      { id: 'gl-planung', text: 'Projektplanung: Phasen, Ressourcen, Zeit- und Kostenplanung' },
      { id: 'gl-analyse', text: 'Analyse und Entscheidung: Ist-Analyse, Soll-Konzept, Alternativen, Wirtschaftlichkeit' },
      { id: 'gl-umsetzung', text: 'Durchführung: wesentliche Umsetzungsschritte mit Begründungen (keine Bedienungsanleitung)' },
      { id: 'gl-qs', text: 'Qualitätssicherung: Tests, Abnahme, Übergabe' },
      { id: 'gl-fazit', text: 'Fazit: Soll-Ist-Vergleich (Zeit/Kosten/Ziele), Lessons Learned, Ausblick' },
      { id: 'gl-anhang', text: 'Anhang: Kundendokumentation, Pläne, Testprotokolle, Kostenaufstellung' },
    ],
  },
  {
    id: 'formalia',
    title: 'Formalia',
    items: [
      { id: 'form-umfang', text: 'Umfang eingehalten (typisch ca. 15 Seiten Bericht + Anlagen)', hint: 'Genaue Seitenzahl, Schriftgrad (oft 11 pt) und Zeilenabstand (oft 1,3) laut IHK-Merkblatt' },
      { id: 'form-verzeichnisse', text: 'Deckblatt, Inhalts-, Abbildungs-, Tabellen-, Abkürzungs- und Quellenverzeichnis' },
      { id: 'form-quellen', text: 'Alle Quellen angegeben, Abbildungen/Tabellen nummeriert und im Text referenziert' },
      { id: 'form-ki', text: 'Nutzung von KI-Werkzeugen gemäß IHK-Vorgaben gekennzeichnet' },
      { id: 'form-erklaerung', text: 'Eigenständigkeitserklärung unterschrieben' },
      { id: 'form-pdf', text: 'Als PDF im geforderten Format fristgerecht hochgeladen' },
      { id: 'form-korrektur', text: 'Korrektur gelesen (Rechtschreibung, Ich-Form, einheitliche Begriffe)' },
    ],
  },
  {
    id: 'praesentation',
    title: 'Präsentation',
    items: [
      { id: 'pr-gliederung', text: 'Foliengliederung steht (Einleitung → Ziel → Planung/Entscheidung → Umsetzung → QS → Fazit)' },
      { id: 'pr-zeit', text: 'Probevortrag mit Stoppuhr: 12–15 Minuten eingehalten' },
      { id: 'pr-folien', text: 'Folien übersichtlich: wenig Text, Grafiken, Foliennummern, gut lesbare Schrift' },
      { id: 'pr-technik', text: 'Technik geklärt: Anschlüsse/Adapter, Ersatz-PDF auf USB-Stick, Vorgaben der IHK' },
      { id: 'pr-feedback', text: 'Feedback eingeholt (Ausbilder, Kollegen oder Präsentations-Coach)' },
    ],
  },
  {
    id: 'fachgespraech',
    title: 'Fachgespräch-Vorbereitung',
    items: [
      { id: 'fg-doku', text: 'Eigene Doku nochmal gelesen: Zahlen, Entscheidungen und Begründungen sitzen' },
      { id: 'fg-alternativen', text: 'Zu jeder Entscheidung Alternativen mit Vor-/Nachteilen parat' },
      { id: 'fg-fachwissen', text: 'Angrenzendes Fachwissen zum Projektthema wiederholt' },
      { id: 'fg-anders', text: 'Antwort auf „Was würden Sie heute anders machen?“ vorbereitet' },
      { id: 'fg-sicherheit', text: 'Datenschutz und IT-Sicherheit im Projekt erklären können' },
      { id: 'fg-probe', text: 'Probe-Fachgespräch geführt (Ausbilder oder Fachgespräch-Simulator)' },
    ],
  },
];
