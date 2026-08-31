import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { SpaceBetween } from '@actual-app/components/space-between';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { PossibleFileAccessRoles } from '@actual-app/core/shared/user-access';

import { Modal, ModalCloseButton, ModalHeader } from '#components/common/Modal';
import { FormField, FormLabel } from '#components/forms';
import { popModal } from '#modals/modalsSlice';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { getUserAccessErrors } from '#util/error';

type CreateInviteLinkProps = Extract<
  ModalType,
  { name: 'create-invite-link' }
>['options'];

export function CreateInviteLink({ fileId }: CreateInviteLinkProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const [role, setRole] = useState('editor');
  const [expiryDays, setExpiryDays] = useState('7');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  async function onCreate() {
    const result = await send('invite-create', {
      fileId,
      role,
      expiryDays: Number(expiryDays) || 7,
    });

    if ('error' in result) {
      setError(getUserAccessErrors(result.error));
      return;
    }

    setLink(`${window.location.origin}/invite/${result.token}`);
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(link);
      dispatch(
        addNotification({
          notification: {
            type: 'message',
            message: t('Invite link copied to clipboard'),
          },
        }),
      );
    } catch {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Failed to copy to clipboard'),
          },
        }),
      );
    }
  }

  return (
    <Modal name="create-invite-link">
      {({ state: { close } }: { state: { close: () => void } }) => (
        <>
          <ModalHeader
            title={t('Invite to household')}
            rightContent={<ModalCloseButton onPress={close} />}
          />
          <SpaceBetween direction="vertical" style={{ marginTop: 10 }}>
            <Text
              style={{ ...styles.verySmallText, color: theme.pageTextLight }}
            >
              <Trans>
                Anyone with this link can join this budget file. They will see
                the entire budget — Actual does not support restricting
                individual accounts or categories per member.
              </Trans>
            </Text>
            <SpaceBetween gap={10} style={{ marginTop: 10 }}>
              <FormField style={{ flex: 1 }}>
                <FormLabel title={t('Role')} htmlFor="role-field" />
                <Select
                  id="role-field"
                  options={Object.entries(PossibleFileAccessRoles)}
                  value={role}
                  onChange={newValue => setRole(newValue)}
                />
              </FormField>
              <FormField style={{ flex: 1 }}>
                <FormLabel
                  title={t('Expires in (days)')}
                  htmlFor="expiry-field"
                />
                <Input
                  id="expiry-field"
                  type="number"
                  min="1"
                  value={expiryDays}
                  onChangeValue={setExpiryDays}
                />
              </FormField>
            </SpaceBetween>

            {link && (
              <View style={{ marginTop: 10 }}>
                <FormLabel title={t('Share this link')} htmlFor="link-field" />
                <SpaceBetween gap={5}>
                  <Input
                    id="link-field"
                    value={link}
                    readOnly
                    style={{ flex: 1 }}
                  />
                  <Button onPress={onCopy}>
                    <Trans>Copy</Trans>
                  </Button>
                </SpaceBetween>
              </View>
            )}
          </SpaceBetween>

          <SpaceBetween
            gap={10}
            style={{
              marginTop: 20,
              justifyContent: 'flex-end',
            }}
          >
            {error && <Text style={{ color: theme.errorText }}>{error}</Text>}
            <Button variant="bare" onPress={() => dispatch(popModal())}>
              <Trans>Close</Trans>
            </Button>
            <Button variant="primary" onPress={onCreate}>
              <Trans>Create link</Trans>
            </Button>
          </SpaceBetween>
        </>
      )}
    </Modal>
  );
}
