import type { Locale } from '../common/locale';

/**
 * The wording of every mail the API sends, in each language the site speaks.
 *
 * Carried over verbatim from the pages this API replaces: the sentences were
 * already written and reviewed in all four languages, and a mail is the one
 * place where a change of voice is most conspicuous. The `toDoSo`/`clickHere`
 * split is what lets the same sentence carry a link in the HTML part and a bare
 * URL in the text part.
 */
export interface MailStrings {
  subject: string;
  /** Opening line, after the greeting. */
  intro: string;
  /** Optional second line, where the mail needs to say why it arrived. */
  note?: string;
  callToAction: string;
  linkLabel: string;
  closing: string;
}

export interface LocaleMailStrings {
  verifyRegistration: MailStrings;
  verifyEmailChange: MailStrings;
  resetPassword: MailStrings;
}

export const MAIL_STRINGS: Record<Locale, LocaleMailStrings> = {
  en: {
    verifyRegistration: {
      subject: 'Welcome to Logigator',
      intro: 'Welcome to Logigator!',
      note: 'Please verify your e-mail address.',
      callToAction: 'In order to do so',
      linkLabel: 'click here',
      closing: 'Have fun building!'
    },
    verifyEmailChange: {
      subject: 'Verify your new email',
      intro: 'Your e-mail address was changed recently.',
      note: 'Please verify your e-mail address.',
      callToAction: 'In order to do so',
      linkLabel: 'click here',
      closing: 'Have fun building!'
    },
    resetPassword: {
      subject: 'Reset your password',
      intro:
        'You have requested a password reset for your Logigator account. If you did not request this, please ignore this email.',
      callToAction: 'In order to reset your password',
      linkLabel: 'click here',
      closing: 'Have fun building!'
    }
  },
  de: {
    verifyRegistration: {
      subject: 'Willkommen bei Logigator',
      intro: 'Willkommen bei Logigator!',
      note: 'Bitte verifiziere deine E-Mail Adresse.',
      callToAction: 'Um sie jetzt zu verifizieren',
      linkLabel: 'klicke hier',
      closing: 'Viel Spaß beim Verwenden von Logigator!'
    },
    verifyEmailChange: {
      subject: 'Verifiziere deine neue Email',
      intro: 'Deine E-Mail-Adresse wurde kürzlich geändert.',
      note: 'Bitte verifiziere deine E-Mail Adresse.',
      callToAction: 'Um sie jetzt zu verifizieren',
      linkLabel: 'klicke hier',
      closing: 'Viel Spaß beim Verwenden von Logigator!'
    },
    resetPassword: {
      subject: 'Passwort zurücksetzen',
      intro:
        'Du hast eine Passwortzurücksetzung für deinen Logigator-Account angefordert. Wenn du dies nicht angefordert hast, ignoriere diese E-Mail.',
      callToAction: 'Um dein Passwort zurückzusetzen',
      linkLabel: 'klicke hier',
      closing: 'Viel Spaß beim Verwenden von Logigator!'
    }
  },
  es: {
    verifyRegistration: {
      subject: 'Bienvenido a Logigator',
      intro: '¡Bienvenido a Logigator!',
      note: 'Por favor, verifica tu dirección de correo electrónico.',
      callToAction: 'Para hacerlo',
      linkLabel: 'haz clic aquí',
      closing: '¡Diviértete construyendo!'
    },
    verifyEmailChange: {
      subject: 'Verifica tu nuevo correo electrónico',
      intro: 'Tu dirección de correo electrónico fue cambiada recientemente.',
      note: 'Por favor, verifica tu dirección de correo electrónico.',
      callToAction: 'Para hacerlo',
      linkLabel: 'haz clic aquí',
      closing: '¡Diviértete construyendo!'
    },
    resetPassword: {
      subject: 'Restablecer contraseña',
      intro:
        'Has solicitado restablecer la contraseña de tu cuenta de Logigator. Si no lo solicitaste, ignora este correo.',
      callToAction: 'Para restablecer tu contraseña',
      linkLabel: 'haz clic aquí',
      closing: '¡Diviértete construyendo!'
    }
  },
  fr: {
    verifyRegistration: {
      subject: 'Bienvenue sur Logigator',
      intro: 'Bienvenue sur Logigator !',
      note: 'Veuillez vérifier votre adresse e-mail.',
      callToAction: 'Pour ce faire',
      linkLabel: 'cliquez ici',
      closing: 'Amusez-vous bien à construire !'
    },
    verifyEmailChange: {
      subject: 'Vérifiez votre nouvel email',
      intro: 'Votre adresse e-mail a récemment été modifiée.',
      note: 'Veuillez vérifier votre adresse e-mail.',
      callToAction: 'Pour ce faire',
      linkLabel: 'cliquez ici',
      closing: 'Amusez-vous bien à construire !'
    },
    resetPassword: {
      subject: 'Réinitialiser le mot de passe',
      intro:
        "Vous avez demandé une réinitialisation du mot de passe pour votre compte Logigator. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
      callToAction: 'Pour réinitialiser votre mot de passe',
      linkLabel: 'cliquez ici',
      closing: 'Amusez-vous bien à construire !'
    }
  }
};
