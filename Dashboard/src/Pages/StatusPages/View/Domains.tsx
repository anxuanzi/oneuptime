import DashboardNavigation from "../../../Utils/Navigation";
import PageComponentProps from "../../PageComponentProps";
import HTTPErrorResponse from "Common/Types/API/HTTPErrorResponse";
import HTTPResponse from "Common/Types/API/HTTPResponse";
import URL from "Common/Types/API/URL";
import BadDataException from "Common/Types/Exception/BadDataException";
import { ErrorFunction, VoidFunction } from "Common/Types/FunctionTypes";
import IconProp from "Common/Types/Icon/IconProp";
import { JSONObject } from "Common/Types/JSON";
import ObjectID from "Common/Types/ObjectID";
import { ButtonStyleType } from "CommonUI/src/Components/Button/Button";
import FormFieldSchemaType from "CommonUI/src/Components/Forms/Types/FormFieldSchemaType";
import ConfirmModal from "CommonUI/src/Components/Modal/ConfirmModal";
import ModelTable from "CommonUI/src/Components/ModelTable/ModelTable";
import FieldType from "CommonUI/src/Components/Types/FieldType";
import { APP_API_URL, StatusPageCNameRecord } from "CommonUI/src/Config";
import API from "CommonUI/src/Utils/API/API";
import ModelAPI from "CommonUI/src/Utils/ModelAPI/ModelAPI";
import Navigation from "CommonUI/src/Utils/Navigation";
import Domain from "Common/Models/DatabaseModels/Domain";
import StatusPageDomain from "Common/Models/DatabaseModels/StatusPageDomain";
import React, {
  Fragment,
  FunctionComponent,
  ReactElement,
  useState,
} from "react";

const StatusPageDelete: FunctionComponent<PageComponentProps> = (
  props: PageComponentProps,
): ReactElement => {
  const modelId: ObjectID = Navigation.getLastParamAsObjectID(1);

  const [refreshToggle, setRefreshToggle] = useState<boolean>(false);

  const [showCnameModal, setShowCnameModal] = useState<boolean>(false);

  const [selectedStatusPageDomain, setSelectedStatusPageDomain] =
    useState<StatusPageDomain | null>(null);

  const [verifyCnameLoading, setVerifyCnameLoading] = useState<boolean>(false);

  const [orderSslLoading, setOrderSslLoading] = useState<boolean>(false);

  const [error, setError] = useState<string>("");

  const [showOrderSSLModal, setShowOrderSSLModal] = useState<boolean>(false);

  return (
    <Fragment>
      <>
        <ModelTable<StatusPageDomain>
          modelType={StatusPageDomain}
          query={{
            projectId: DashboardNavigation.getProjectId()?.toString(),
            statusPageId: modelId,
          }}
          name="Status Page > Domains"
          id="domains-table"
          isDeleteable={true}
          isCreateable={true}
          cardProps={{
            title: "Custom Domains",
            description: `Important: Please add ${StatusPageCNameRecord} as your CNAME for these domains for this to work.`,
          }}
          refreshToggle={refreshToggle}
          onBeforeCreate={(
            item: StatusPageDomain,
          ): Promise<StatusPageDomain> => {
            if (!props.currentProject || !props.currentProject._id) {
              throw new BadDataException("Project ID cannot be null");
            }
            item.statusPageId = modelId;
            item.projectId = new ObjectID(props.currentProject._id);
            return Promise.resolve(item);
          }}
          actionButtons={[
            {
              title: "Add CNAME",
              buttonStyleType: ButtonStyleType.SUCCESS_OUTLINE,
              icon: IconProp.Check,
              isVisible: (item: StatusPageDomain): boolean => {
                if (item["isCnameVerified"]) {
                  return false;
                }

                return true;
              },
              onClick: async (
                item: StatusPageDomain,
                onCompleteAction: VoidFunction,
                onError: ErrorFunction,
              ) => {
                try {
                  setShowCnameModal(true);
                  setSelectedStatusPageDomain(item);
                  onCompleteAction();
                } catch (err) {
                  onCompleteAction();
                  onError(err as Error);
                }
              },
            },
            {
              title: "Order Free SSL",
              buttonStyleType: ButtonStyleType.SUCCESS_OUTLINE,
              icon: IconProp.Check,
              isVisible: (item: StatusPageDomain): boolean => {
                if (item["isCnameVerified"] && !item.isSslOrdered) {
                  return true;
                }

                return false;
              },
              onClick: async (
                item: StatusPageDomain,
                onCompleteAction: VoidFunction,
                onError: ErrorFunction,
              ) => {
                try {
                  setShowOrderSSLModal(true);
                  setSelectedStatusPageDomain(item);
                  onCompleteAction();
                } catch (err) {
                  onCompleteAction();
                  setSelectedStatusPageDomain(null);
                  onError(err as Error);
                }
              },
            },
          ]}
          noItemsMessage={"No custom domains found."}
          viewPageRoute={Navigation.getCurrentRoute()}
          selectMoreFields={{
            isSslOrdered: true,
            isSslProvisioned: true,
            isCnameVerified: true,
          }}
          formFields={[
            {
              field: {
                subdomain: true,
              },
              title: "Subdomain",
              fieldType: FormFieldSchemaType.Text,
              required: true,
              placeholder: "status",
              validation: {
                minLength: 2,
              },
            },
            {
              field: {
                domain: true,
              },
              title: "Domain",
              description:
                "Please select a verified domain from this list. If you do not see any domains in this list, please head over to More -> Project Settings -> Custom Domains to add one.",
              fieldType: FormFieldSchemaType.Dropdown,
              dropdownModal: {
                type: Domain,
                labelField: "domain",
                valueField: "_id",
              },
              required: true,
              placeholder: "Select domain",
            },
          ]}
          showRefreshButton={true}
          filters={[
            {
              field: {
                fullDomain: true,
              },
              title: "Domain",
              type: FieldType.Text,
            },
            {
              field: {},
              title: "CNAME Valid",
              type: FieldType.Boolean,
            },
            {
              field: {},
              title: "SSL Provisioned",
              type: FieldType.Boolean,
            },
          ]}
          columns={[
            {
              field: {
                fullDomain: true,
              },
              title: "Domain",
              type: FieldType.Text,
            },
            {
              field: {
                isCnameVerified: true,
              },
              title: "Status",
              type: FieldType.Element,

              getElement: (item: StatusPageDomain): ReactElement => {
                if (!item.isCnameVerified) {
                  return (
                    <span>
                      <span className="font-semibold">Action Required:</span>{" "}
                      Please add your CNAME record.
                    </span>
                  );
                }

                if (!item.isSslOrdered) {
                  return (
                    <span>
                      <span className="font-semibold">Action Required:</span>{" "}
                      Please order SSL certificate.
                    </span>
                  );
                }

                if (!item.isSslProvisioned) {
                  return (
                    <span>
                      No action is required. This SSL certificate will be
                      provisioned in 1 hour. If this does not happen. Please
                      contact support.
                    </span>
                  );
                }

                return (
                  <span>
                    Certificate Provisioned. We will automatiucally renew this
                    certificate. No action required.{" "}
                  </span>
                );
              },
            },
          ]}
        />

        {selectedStatusPageDomain?.fullDomain && showCnameModal && (
          <ConfirmModal
            title={`Add CNAME`}
            description={
              StatusPageCNameRecord ? (
                <div>
                  <span>
                    Please add CNAME record to your domain. Details of the CNAME
                    records are:
                  </span>
                  <br />
                  <br />
                  <span>
                    <b>Record Type: </b> CNAME
                  </span>
                  <br />
                  <span>
                    <b>Name: </b>
                    {selectedStatusPageDomain?.fullDomain}
                  </span>
                  <br />
                  <span>
                    <b>Content: </b>
                    {StatusPageCNameRecord}
                  </span>
                  <br />
                  <br />
                  <span>
                    Once you have done this, it should take 24 hours to
                    automatically verify.
                  </span>
                </div>
              ) : (
                <div>
                  <span>
                    Custom Domains not enabled for this OneUptime installation.
                    Please contact your server admin to enable this feature.
                  </span>
                </div>
              )
            }
            submitButtonText={"Verify CNAME"}
            onClose={() => {
              setShowCnameModal(false);
              setError("");
              return setSelectedStatusPageDomain(null);
            }}
            isLoading={verifyCnameLoading}
            error={error}
            onSubmit={async () => {
              try {
                setVerifyCnameLoading(true);
                setError("");

                const response: HTTPResponse<JSONObject> | HTTPErrorResponse =
                  await API.get<JSONObject>(
                    URL.fromString(APP_API_URL.toString()).addRoute(
                      `/${
                        new StatusPageDomain().crudApiPath
                      }/verify-cname/${selectedStatusPageDomain?.id?.toString()}`,
                    ),
                    {},
                    ModelAPI.getCommonHeaders(),
                  );

                if (response.isFailure()) {
                  throw response;
                }

                setShowCnameModal(false);
                setRefreshToggle(!refreshToggle);
                setSelectedStatusPageDomain(null);
              } catch (err) {
                setError(API.getFriendlyMessage(err));
              }

              setVerifyCnameLoading(false);
            }}
          />
        )}

        {showOrderSSLModal && selectedStatusPageDomain && (
          <ConfirmModal
            title={`Order Free SSL Certificate for this Status Page`}
            description={
              StatusPageCNameRecord ? (
                <div>
                  Please click on the button below to order SSL for this domain.
                  We will use LetsEncrypt to order a certificate. This process
                  is secure and completely free. The certificate takes 3 hours
                  to provision after its been ordered.
                </div>
              ) : (
                <div>
                  <span>
                    Custom Domains not enabled for this OneUptime installation.
                    Please contact your server admin to enable this feature.
                  </span>
                </div>
              )
            }
            submitButtonText={"Order Free SSL"}
            onClose={() => {
              setShowOrderSSLModal(false);
              setError("");
              return setSelectedStatusPageDomain(null);
            }}
            isLoading={orderSslLoading}
            error={error}
            onSubmit={async () => {
              try {
                setOrderSslLoading(true);
                setError("");

                const response: HTTPResponse<JSONObject> | HTTPErrorResponse =
                  await API.get<JSONObject>(
                    URL.fromString(APP_API_URL.toString()).addRoute(
                      `/${
                        new StatusPageDomain().crudApiPath
                      }/order-ssl/${selectedStatusPageDomain?.id?.toString()}`,
                    ),
                    {},
                    ModelAPI.getCommonHeaders(),
                  );

                if (response.isFailure()) {
                  throw response;
                }

                setShowOrderSSLModal(false);
                setRefreshToggle(!refreshToggle);
                setSelectedStatusPageDomain(null);
              } catch (err) {
                setError(API.getFriendlyMessage(err));
              }

              setOrderSslLoading(false);
            }}
          />
        )}
      </>
    </Fragment>
  );
};

export default StatusPageDelete;
