import { useEffect, useState } from 'react';
import { useCameraPermissions } from 'expo-camera';

export interface UseCameraPermissionReturn {
  granted: boolean;
  requesting: boolean;
  request: () => Promise<void>;
}

export function useCameraPermission(): UseCameraPermissionReturn {
  const [permission, requestPermission] = useCameraPermissions();
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (permission?.status === 'undetermined') {
      setRequesting(true);
      requestPermission().finally(() => setRequesting(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function request(): Promise<void> {
    setRequesting(true);
    try {
      await requestPermission();
    } finally {
      setRequesting(false);
    }
  }

  return {
    granted: permission?.granted ?? false,
    requesting,
    request,
  };
}
