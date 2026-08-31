import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { Paragraph } from '@actual-app/components/paragraph';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { TransObjectLiteral } from '@actual-app/core/types/util';

import { loadAllFiles } from '#budgetfiles/budgetfilesSlice';
import { BackToFileListButton } from '#components/admin/UserDirectory/UserDirectoryPage';
import { useDispatch } from '#redux';
import { getUserAccessErrors } from '#util/error';

import { Title } from './subscribe/common';

export function AcceptInvitePage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { token } = useParams();

  const [preview, setPreview] = useState<{
    role: string;
    fileName: string | null;
  } | null>(null);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    async function loadPreview() {
      const result = await send('invite-get-preview', token);
      if ('error' in result) {
        setError(getUserAccessErrors(result.error));
        return;
      }
      setPreview(result);
    }

    void loadPreview();
  }, [token]);

  async function onAccept() {
    const result = await send('invite-accept', token);
    if ('error' in result) {
      setError(getUserAccessErrors(result.error));
      return;
    }

    setAccepted(true);
    await dispatch(loadAllFiles());
  }

  return (
    <View style={{ maxWidth: 500, alignSelf: 'center', textAlign: 'center' }}>
      <Title text={t('Household invite')} />

      {error && (
        <Paragraph style={{ color: theme.errorText }}>{error}</Paragraph>
      )}

      {!error && !accepted && preview && (
        <>
          <Paragraph>
            <Trans>
              You have been invited to join{' '}
              <strong>
                {
                  {
                    fileName: preview.fileName ?? t('this budget'),
                  } as TransObjectLiteral
                }
              </strong>{' '}
              as a{' '}
              <strong>{{ role: preview.role } as TransObjectLiteral}</strong>.
            </Trans>
          </Paragraph>
          <Paragraph>
            <Trans>
              Everyone with access to this budget sees the entire budget —
              Actual does not support restricting individual accounts or
              categories per member.
            </Trans>
          </Paragraph>
          <Button variant="primary" onPress={onAccept}>
            <Trans>Join budget</Trans>
          </Button>
        </>
      )}

      {accepted && (
        <Paragraph>
          <Trans>
            You now have access to this budget. Select it from the file list to
            open it.
          </Trans>
        </Paragraph>
      )}

      <View style={{ marginTop: 20 }}>
        <BackToFileListButton />
      </View>
    </View>
  );
}
