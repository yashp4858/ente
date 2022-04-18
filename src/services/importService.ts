import { Collection } from 'types/collection';
import { ElectronFile, FileWithCollection } from 'types/upload';
import { runningInBrowser } from 'utils/common';
import { logError } from 'utils/sentry';

interface PendingUploads {
    files: ElectronFile[];
    collectionName: string;
}
class ImportService {
    ElectronAPIs: any;
    private allElectronAPIsExist: boolean = false;

    constructor() {
        this.ElectronAPIs = runningInBrowser() && window['ElectronAPIs'];
        this.allElectronAPIsExist = !!this.ElectronAPIs?.getPendingUploads;
    }

    checkAllElectronAPIsExists = () => this.allElectronAPIsExist;

    async showUploadFilesDialog(): Promise<ElectronFile[]> {
        if (this.allElectronAPIsExist) {
            return this.ElectronAPIs.showUploadFilesDialog();
        }
    }

    async showUploadDirsDialog(): Promise<ElectronFile[]> {
        if (this.allElectronAPIsExist) {
            return this.ElectronAPIs.showUploadDirsDialog();
        }
    }

    async getPendingUploads(): Promise<PendingUploads> {
        try {
            if (this.allElectronAPIsExist) {
                const pendingUploads =
                    (await this.ElectronAPIs.getPendingUploads()) as PendingUploads;
                return pendingUploads;
            }
        } catch (e) {
            logError(e, 'failed to getPendingUploads ');
            return { files: [], collectionName: null };
        }
    }

    async setToUploadFiles(
        files: FileWithCollection[],
        collections: Collection[]
    ) {
        if (this.allElectronAPIsExist) {
            let collectionName: string;
            /* collection being one suggest one of two things
                1. Either the user has upload to a single existing collection
                2. Created a new single collection to upload to 
                    may have had multiple folder, but chose to upload
                    to one album
                hence saving the collection name when upload collection count is 1
                helps the info of user choosing this options
                and on next upload we can directly start uploading to this collection 
            */
            if (collections.length === 1) {
                collectionName = collections[0].name;
            }
            const filePaths = files.map(
                (file) => (file.file as ElectronFile).path
            );
            this.ElectronAPIs.setToUploadFiles(filePaths);
            this.ElectronAPIs.setToUploadCollection(collectionName);
        }
    }
    updatePendingUploads(files: FileWithCollection[]) {
        if (this.allElectronAPIsExist) {
            const filePaths = [];
            for (const fileWithCollection of files) {
                if (fileWithCollection.isLivePhoto) {
                    filePaths.push(
                        (
                            fileWithCollection.livePhotoAssets
                                .image as ElectronFile
                        ).path,
                        (
                            fileWithCollection.livePhotoAssets
                                .video as ElectronFile
                        ).path
                    );
                } else {
                    filePaths.push(
                        (fileWithCollection.file as ElectronFile).path
                    );
                }
            }
            this.ElectronAPIs.setToUploadFiles(filePaths);
        }
    }
}

export default new ImportService();
