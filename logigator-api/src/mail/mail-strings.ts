import type { DocumentReportReason } from '@logigator/contract';
import type { Locale } from '../common/locale';

/**
 * The wording of one mail. `{duration}` in the footnote is how long the link
 * works, written out in the mail's language; the moderation mails name the
 * document as `{name}` and the reason it was hidden as `{reason}`.
 */
export interface MailStrings {
  subject: string;
  heading: string;
  /** Paragraphs between the greeting and the button. */
  body: string[];
  button: string;
  /** Below the button: how long the link works, and what to do if the mail was not expected. */
  footnote: string;
}

/** The lines every mail in a language shares. `{username}` is the recipient's. */
export interface CommonMailStrings {
  greeting: string;
  /** Introduces the bare link under the button, for clients that break it. */
  fallback: string;
  imprint: string;
  privacyPolicy: string;
}

export interface LocaleMailStrings {
  common: CommonMailStrings;
  mails: {
    verifyRegistration: MailStrings;
    verifyEmailChange: MailStrings;
    resetPassword: MailStrings;
    /** To a document's owner, after a moderator hid it. */
    documentHidden: MailStrings;
    /** To a document's owner, after the machine's verdict hid it. */
    documentHiddenAutomatically: MailStrings;
    /** To a document's owner, after a moderator unhid it. */
    documentUnhidden: MailStrings;
  };
  /**
   * The reason an automatic hide gives its owner, by the verdict's category:
   * the report dialog's labels, so the owner reads the words a reader picks
   * from. The model's own note never reaches the owner.
   */
  hiddenReasons: Record<DocumentReportReason, string>;
}

/**
 * Every mail the API sends, in each language the site speaks. The footer
 * labels are the site footer's, so a link reads the same on both ends.
 */
export const MAIL_STRINGS: Record<Locale, LocaleMailStrings> = {
  en: {
    common: {
      greeting: 'Hi {username},',
      fallback:
        'If the button does not work, copy this link into your browser:',
      imprint: 'Imprint',
      privacyPolicy: 'Privacy Policy'
    },
    mails: {
      verifyRegistration: {
        subject: 'Welcome to Logigator',
        heading: 'Welcome to Logigator',
        body: [
          'Confirm your email address to finish creating your account. You can sign in once it is confirmed.'
        ],
        button: 'Confirm email address',
        footnote:
          'This link works for {duration}. If you did not sign up for Logigator, you can ignore this email.'
      },
      verifyEmailChange: {
        subject: 'Confirm your new email address',
        heading: 'Confirm your new email address',
        body: [
          'You asked to change the email address of your Logigator account to this one. Your account keeps its current address until you confirm.'
        ],
        button: 'Confirm new address',
        footnote:
          'This link works for {duration}. If you did not ask for this change, you can ignore this email.'
      },
      resetPassword: {
        subject: 'Reset your password',
        heading: 'Reset your password',
        body: [
          'Someone asked to reset the password of your Logigator account. Choose a new one with the button below.'
        ],
        button: 'Choose a new password',
        footnote:
          'This link works for {duration}. If you did not ask for this, ignore this email and your password stays the same.'
      },
      documentHidden: {
        subject: 'Your document has been hidden',
        heading: 'Your document has been hidden',
        body: [
          'A moderator has hidden your document “{name}”. It is no longer shown in the community, and only you can open it.',
          'Reason: {reason}'
        ],
        button: 'Open the document',
        footnote:
          'If you think this is a mistake, write to us at the contact address in our imprint, linked below.'
      },
      documentHiddenAutomatically: {
        subject: 'Your document has been hidden',
        heading: 'Your document has been hidden',
        body: [
          'Your document “{name}” has been hidden automatically. It is no longer shown in the community, and only you can open it.',
          'Reason: {reason}',
          'A person will review this decision and show the document again if it was a mistake.'
        ],
        button: 'Open the document',
        footnote:
          'If you think this is a mistake, write to us at the contact address in our imprint, linked below.'
      },
      documentUnhidden: {
        subject: 'Your document is visible again',
        heading: 'Your document is visible again',
        body: [
          'Your document “{name}” is shown in the community again. Its link, its visibility and its stars are as they were before it was hidden.'
        ],
        button: 'Open the document',
        footnote: 'There is nothing you need to do.'
      }
    },
    hiddenReasons: {
      illegal: 'Illegal content',
      copyright: 'Copyright infringement',
      personal_data: 'Personal data',
      harassment: 'Harassment or hate',
      spam: 'Spam',
      other: 'Another breach of the rules'
    }
  },
  de: {
    common: {
      greeting: 'Hallo {username},',
      fallback:
        'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
      imprint: 'Impressum',
      privacyPolicy: 'Datenschutzerklärung'
    },
    mails: {
      verifyRegistration: {
        subject: 'Willkommen bei Logigator',
        heading: 'Willkommen bei Logigator',
        body: [
          'Bestätige deine E-Mail-Adresse, um dein Konto fertig einzurichten. Danach kannst du dich anmelden.'
        ],
        button: 'E-Mail-Adresse bestätigen',
        footnote:
          'Der Link ist {duration} gültig. Wenn du dich nicht bei Logigator registriert hast, kannst du diese E-Mail ignorieren.'
      },
      verifyEmailChange: {
        subject: 'Bestätige deine neue E-Mail-Adresse',
        heading: 'Bestätige deine neue E-Mail-Adresse',
        body: [
          'Du möchtest die E-Mail-Adresse deines Logigator-Kontos auf diese Adresse ändern. Bis du sie bestätigst, behält dein Konto die bisherige Adresse.'
        ],
        button: 'Neue Adresse bestätigen',
        footnote:
          'Der Link ist {duration} gültig. Wenn du diese Änderung nicht angefordert hast, kannst du diese E-Mail ignorieren.'
      },
      resetPassword: {
        subject: 'Passwort zurücksetzen',
        heading: 'Passwort zurücksetzen',
        body: [
          'Für dein Logigator-Konto wurde ein neues Passwort angefordert. Über den Button unten legst du es fest.'
        ],
        button: 'Neues Passwort festlegen',
        footnote:
          'Der Link ist {duration} gültig. Wenn du das nicht angefordert hast, ignoriere diese E-Mail. Dein Passwort bleibt dann unverändert.'
      },
      documentHidden: {
        subject: 'Dein Dokument wurde ausgeblendet',
        heading: 'Dein Dokument wurde ausgeblendet',
        body: [
          'Die Moderation hat dein Dokument „{name}“ ausgeblendet. Es wird nicht mehr in der Community gezeigt, und nur du kannst es öffnen.',
          'Grund: {reason}'
        ],
        button: 'Dokument öffnen',
        footnote:
          'Wenn du das für einen Fehler hältst, schreib uns an die Kontaktadresse in unserem Impressum, das unten verlinkt ist.'
      },
      documentHiddenAutomatically: {
        subject: 'Dein Dokument wurde ausgeblendet',
        heading: 'Dein Dokument wurde ausgeblendet',
        body: [
          'Dein Dokument „{name}“ wurde automatisch ausgeblendet. Es wird nicht mehr in der Community gezeigt, und nur du kannst es öffnen.',
          'Grund: {reason}',
          'Ein Mensch prüft diese Entscheidung und zeigt das Dokument wieder an, falls sie ein Fehler war.'
        ],
        button: 'Dokument öffnen',
        footnote:
          'Wenn du das für einen Fehler hältst, schreib uns an die Kontaktadresse in unserem Impressum, das unten verlinkt ist.'
      },
      documentUnhidden: {
        subject: 'Dein Dokument ist wieder sichtbar',
        heading: 'Dein Dokument ist wieder sichtbar',
        body: [
          'Dein Dokument „{name}“ wird wieder in der Community gezeigt. Link, Sichtbarkeit und Sterne sind wie vor dem Ausblenden.'
        ],
        button: 'Dokument öffnen',
        footnote: 'Du musst nichts weiter tun.'
      }
    },
    hiddenReasons: {
      illegal: 'Rechtswidriger Inhalt',
      copyright: 'Urheberrechtsverletzung',
      personal_data: 'Personenbezogene Daten',
      harassment: 'Belästigung oder Hass',
      spam: 'Spam',
      other: 'Ein anderer Regelverstoß'
    }
  },
  es: {
    common: {
      greeting: 'Hola, {username}:',
      fallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
      imprint: 'Aviso Legal',
      privacyPolicy: 'Política de Privacidad'
    },
    mails: {
      verifyRegistration: {
        subject: 'Bienvenido a Logigator',
        heading: 'Bienvenido a Logigator',
        body: [
          'Confirma tu dirección de correo para terminar de crear tu cuenta. Después podrás iniciar sesión.'
        ],
        button: 'Confirmar dirección de correo',
        footnote:
          'Este enlace es válido durante {duration}. Si no te registraste en Logigator, puedes ignorar este correo.'
      },
      verifyEmailChange: {
        subject: 'Confirma tu nueva dirección de correo',
        heading: 'Confirma tu nueva dirección de correo',
        body: [
          'Has pedido cambiar la dirección de correo de tu cuenta de Logigator a esta. Tu cuenta conserva la dirección actual hasta que la confirmes.'
        ],
        button: 'Confirmar nueva dirección',
        footnote:
          'Este enlace es válido durante {duration}. Si no pediste este cambio, puedes ignorar este correo.'
      },
      resetPassword: {
        subject: 'Restablece tu contraseña',
        heading: 'Restablece tu contraseña',
        body: [
          'Se ha pedido restablecer la contraseña de tu cuenta de Logigator. Elige una nueva con el botón de abajo.'
        ],
        button: 'Elegir una nueva contraseña',
        footnote:
          'Este enlace es válido durante {duration}. Si no lo pediste, ignora este correo y tu contraseña seguirá siendo la misma.'
      },
      documentHidden: {
        subject: 'Tu documento se ha ocultado',
        heading: 'Tu documento se ha ocultado',
        body: [
          'El equipo de moderación ha ocultado tu documento «{name}». Ya no se muestra en la comunidad y solo tú puedes abrirlo.',
          'Motivo: {reason}'
        ],
        button: 'Abrir el documento',
        footnote:
          'Si crees que se trata de un error, escríbenos a la dirección de contacto de nuestro aviso legal, enlazado abajo.'
      },
      documentHiddenAutomatically: {
        subject: 'Tu documento se ha ocultado',
        heading: 'Tu documento se ha ocultado',
        body: [
          'Tu documento «{name}» se ha ocultado automáticamente. Ya no se muestra en la comunidad y solo tú puedes abrirlo.',
          'Motivo: {reason}',
          'Una persona revisará esta decisión y volverá a mostrar el documento si fue un error.'
        ],
        button: 'Abrir el documento',
        footnote:
          'Si crees que se trata de un error, escríbenos a la dirección de contacto de nuestro aviso legal, enlazado abajo.'
      },
      documentUnhidden: {
        subject: 'Tu documento vuelve a estar visible',
        heading: 'Tu documento vuelve a estar visible',
        body: [
          'Tu documento «{name}» vuelve a mostrarse en la comunidad. Su enlace, su visibilidad y sus estrellas siguen como antes de ocultarse.'
        ],
        button: 'Abrir el documento',
        footnote: 'No tienes que hacer nada.'
      }
    },
    hiddenReasons: {
      illegal: 'Contenido ilegal',
      copyright: 'Infracción de derechos de autor',
      personal_data: 'Datos personales',
      harassment: 'Acoso u odio',
      spam: 'Spam',
      other: 'Otra infracción de las normas'
    }
  },
  fr: {
    common: {
      greeting: 'Bonjour {username},',
      fallback:
        'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
      imprint: 'Mentions légales',
      privacyPolicy: 'Politique de confidentialité'
    },
    mails: {
      verifyRegistration: {
        subject: 'Bienvenue sur Logigator',
        heading: 'Bienvenue sur Logigator',
        body: [
          'Confirmez votre adresse e-mail pour terminer la création de votre compte. Vous pourrez ensuite vous connecter.'
        ],
        button: 'Confirmer l’adresse e-mail',
        footnote:
          'Ce lien est valable {duration}. Si vous ne vous êtes pas inscrit sur Logigator, vous pouvez ignorer cet e-mail.'
      },
      verifyEmailChange: {
        subject: 'Confirmez votre nouvelle adresse e-mail',
        heading: 'Confirmez votre nouvelle adresse e-mail',
        body: [
          'Vous avez demandé à remplacer l’adresse e-mail de votre compte Logigator par celle-ci. Votre compte garde son adresse actuelle jusqu’à votre confirmation.'
        ],
        button: 'Confirmer la nouvelle adresse',
        footnote:
          'Ce lien est valable {duration}. Si vous n’avez pas demandé ce changement, vous pouvez ignorer cet e-mail.'
      },
      resetPassword: {
        subject: 'Réinitialisez votre mot de passe',
        heading: 'Réinitialisez votre mot de passe',
        body: [
          'Une réinitialisation du mot de passe de votre compte Logigator a été demandée. Choisissez-en un nouveau avec le bouton ci-dessous.'
        ],
        button: 'Choisir un nouveau mot de passe',
        footnote:
          'Ce lien est valable {duration}. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.'
      },
      documentHidden: {
        subject: 'Votre document a été masqué',
        heading: 'Votre document a été masqué',
        body: [
          'L’équipe de modération a masqué votre document « {name} ». Il n’est plus affiché dans la communauté et n’est plus accessible qu’à vous.',
          'Motif : {reason}'
        ],
        button: 'Ouvrir le document',
        footnote:
          'Si vous pensez qu’il s’agit d’une erreur, écrivez-nous à l’adresse de contact de nos mentions légales, dont le lien figure ci-dessous.'
      },
      documentHiddenAutomatically: {
        subject: 'Votre document a été masqué',
        heading: 'Votre document a été masqué',
        body: [
          'Votre document « {name} » a été masqué automatiquement. Il n’est plus affiché dans la communauté et n’est plus accessible qu’à vous.',
          'Motif : {reason}',
          'Une personne va examiner cette décision et affichera de nouveau le document s’il s’agissait d’une erreur.'
        ],
        button: 'Ouvrir le document',
        footnote:
          'Si vous pensez qu’il s’agit d’une erreur, écrivez-nous à l’adresse de contact de nos mentions légales, dont le lien figure ci-dessous.'
      },
      documentUnhidden: {
        subject: 'Votre document est de nouveau visible',
        heading: 'Votre document est de nouveau visible',
        body: [
          'Votre document « {name} » est de nouveau affiché dans la communauté. Son lien, sa visibilité et ses étoiles sont tels qu’avant son masquage.'
        ],
        button: 'Ouvrir le document',
        footnote: 'Vous n’avez rien à faire.'
      }
    },
    hiddenReasons: {
      illegal: 'Contenu illicite',
      copyright: 'Atteinte au droit d’auteur',
      personal_data: 'Données personnelles',
      harassment: 'Harcèlement ou haine',
      spam: 'Spam',
      other: 'Autre infraction aux règles'
    }
  }
};
