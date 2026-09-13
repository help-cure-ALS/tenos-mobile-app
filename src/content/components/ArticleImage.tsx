/**
 * Cover image of an article — served from the on-disk image cache
 * (contentClient.cachedImageUri), so previously loaded covers render
 * offline. Renders nothing while unresolved or on failure (the card
 * then falls back to text-only).
 */
import React, { useEffect, useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { cachedImageUri } from '../contentClient';

type Props = {
    imageRef?: string;
    style: StyleProp<ImageStyle>;
};

export function ArticleImage({ imageRef, style }: Props) {
    const [uri, setUri] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setUri(null);
        setFailed(false);
        void cachedImageUri(imageRef).then((resolved) => {
            if (!cancelled) setUri(resolved);
        });
        return () => { cancelled = true; };
    }, [imageRef]);

    if (!uri || failed) return null;
    return (
        <Image
            source={{ uri }}
            style={style}
            resizeMode="cover"
            onError={() => setFailed(true)}
        />
    );
}
